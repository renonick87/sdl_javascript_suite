/*
 * Copyright (c) 2019, Livio, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following
 * disclaimer in the documentation and/or other materials provided with the
 * distribution.
 *
 * Neither the name of the Livio Inc. nor the names of its contributors
 * may be used to endorse or promote products derived from this software
 * without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import { FrameType } from '../enums/FrameType.js';



package com.smartdevicelink.transport;

import com.smartdevicelink.protocol.SdlPacket;

import static com.smartdevicelink.protocol.SdlProtocol.V1_HEADER_SIZE;
import static com.smartdevicelink.protocol.SdlProtocol.V1_V2_MTU_SIZE;


public class SdlPsm{
	//private static final String TAG = "Sdl PSM";
	//Each state represents the byte that should be incomming


	int state ;

	int version;
	boolean compression;
	int frameType;
	int serviceType;
	int controlFrameInfo;
	int sessionId;
	int dumpSize, dataLength;
	int messageId = 0;

	byte[] payload;

	public SdlPsm(){
		reset();
	}

	public boolean handleByte(byte data) {
		//Log.trace(TAG, data + " = incomming");
		state = transitionOnInput(data,state);

		if(state==ERROR_STATE){
			return false;
		}
		return true;
	}

	private int transitionOnInput(byte rawByte, int state){
		switch(state){
		case START_STATE:
			version = (rawByte&(byte)VERSION_MASK)>>4;
			//Log.trace(TAG, "Version: " + version);
			if(version==0){ //It should never be 0
				return ERROR_STATE;
			}
			compression = (1 == ((rawByte&(byte)COMPRESSION_MASK)>>3));


			frameType = rawByte&(byte)FRAME_TYPE_MASK;
			//Log.trace(TAG, rawByte + " = Frame Type: " + frameType);

			if((version < 1 || version > 5) //These are known versions supported by this library.
					&& frameType!=SdlPacket.FRAME_TYPE_CONTROL){
					return ERROR_STATE;
			}

			if(frameType<SdlPacket.FRAME_TYPE_CONTROL || frameType > SdlPacket.FRAME_TYPE_CONSECUTIVE){
				return ERROR_STATE;
			}

			return SERVICE_TYPE_STATE;

		case SERVICE_TYPE_STATE:
			serviceType = (int)(rawByte&0xFF);
			return CONTROL_FRAME_INFO_STATE;

		case CONTROL_FRAME_INFO_STATE:
			controlFrameInfo = (int)(rawByte&0xFF);
			//Log.trace(TAG,"Frame Info: " + controlFrameInfo);
			switch(frameType){
				case SdlPacket.FRAME_TYPE_CONTROL:
					/*if(frameInfo<FRAME_INFO_HEART_BEAT
							|| (frameInfo>FRAME_INFO_END_SERVICE_ACK
									&& (frameInfo!=FRAME_INFO_SERVICE_DATA_ACK || frameInfo!=FRAME_INFO_HEART_BEAT_ACK))){
						return ERROR_STATE;
					}*/ //Although some bits are reserved...whatever
					break;
				case SdlPacket.FRAME_TYPE_SINGLE: //Fall through since they are both the same
				case SdlPacket.FRAME_TYPE_FIRST:
					if(controlFrameInfo!=0x00){
						return ERROR_STATE;
					}
					break;
				case SdlPacket.FRAME_TYPE_CONSECUTIVE:
					//It might be a good idea to check packet sequence numbers here
					break;

				default:
					return ERROR_STATE;
			}
			return SESSION_ID_STATE;

		case SESSION_ID_STATE:
			sessionId = (int)(rawByte&0xFF);
			return DATA_SIZE_1_STATE;

		case DATA_SIZE_1_STATE:
			//First data size byte
			//Log.d(TAG, "Data byte 1: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<24; //3 bytes x 8 bits
			//Log.d(TAG, "Data Size 1 : " + dataLength);
			return DATA_SIZE_2_STATE;

		case DATA_SIZE_2_STATE:
			//Log.d(TAG, "Data byte 2: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<16; //2 bytes x 8 bits
			//Log.d(TAG, "Data Size 2 : " + dataLength);
			return DATA_SIZE_3_STATE;

		case DATA_SIZE_3_STATE:
			//Log.d(TAG, "Data byte 3: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<8; //1 byte x 8 bits
			//Log.d(TAG, "Data Size 3 : " + dataLength);
			return DATA_SIZE_4_STATE;

		case DATA_SIZE_4_STATE:
			//Log.d(TAG, "Data byte 4: " + rawByte);
			dataLength+=((int)rawByte) & 0xFF;
			//Log.trace(TAG, "Data Size: " + dataLength);
			//We should have data length now for the pump state
			switch(frameType){ //If all is correct we should break out of this switch statement
			case SdlPacket.FRAME_TYPE_SINGLE:
			case SdlPacket.FRAME_TYPE_CONSECUTIVE:
				break;
			case SdlPacket.FRAME_TYPE_CONTROL:
				//Ok, well here's some interesting bit of knowledge. Because the start session request is from the phone with no knowledge of version it sends out
				//a v1 packet. THEREFORE there is no message id field. **** Now you know and knowing is half the battle ****
				if(version==1 && controlFrameInfo == SdlPacket.FRAME_INFO_START_SERVICE){
					if(dataLength==0){
						return FINISHED_STATE; //We are done if we don't have any payload
					}
					if(dataLength <= V1_V2_MTU_SIZE - V1_HEADER_SIZE){ // sizes from protocol/WiProProtocol.java
						payload = new byte[dataLength];
					}else{
						return ERROR_STATE;
					}
					dumpSize = dataLength;
					return DATA_PUMP_STATE;
				}
				break;

			case SdlPacket.FRAME_TYPE_FIRST:
				if(dataLength==FIRST_FRAME_DATA_SIZE){
					break;
				}
			default:
				return ERROR_STATE;
			}
			if(version==1){ //Version 1 packets will not have message id's
				if(dataLength == 0){
					return FINISHED_STATE; //We are done if we don't have any payload
				}
				if(dataLength <= V1_V2_MTU_SIZE - V1_HEADER_SIZE){ // sizes from protocol/WiProProtocol.java
					payload = new byte[dataLength];
				}else{
					return ERROR_STATE;
				}
				dumpSize = dataLength;
				return DATA_PUMP_STATE;
			}else{
				return MESSAGE_1_STATE;
			}

		case MESSAGE_1_STATE:
			messageId += ((int)(rawByte& 0xFF))<<24; //3 bytes x 8 bits
			return MESSAGE_2_STATE;

		case MESSAGE_2_STATE:
			messageId += ((int)(rawByte& 0xFF))<<16; //2 bytes x 8 bits
			return MESSAGE_3_STATE;

		case MESSAGE_3_STATE:
			messageId += ((int)(rawByte& 0xFF))<<8; //1 byte x 8 bits
			return MESSAGE_4_STATE;

		case MESSAGE_4_STATE:
			messageId+=((int)rawByte) & 0xFF;

			if(dataLength==0){
				return FINISHED_STATE; //We are done if we don't have any payload
			}
			try{
				payload = new byte[dataLength];
			}catch(OutOfMemoryError oom){
				return ERROR_STATE;
			}
			dumpSize = dataLength;
			return DATA_PUMP_STATE;

		case DATA_PUMP_STATE:
			payload[dataLength-dumpSize] = rawByte;
			dumpSize--;
			//Do we have any more bytes to read in?
			if(dumpSize>0){
				return DATA_PUMP_STATE;
			}
			else if(dumpSize==0){
				return FINISHED_STATE;
			}else{
				return ERROR_STATE;
			}
		case FINISHED_STATE: //We shouldn't be here...Should have been reset
		default:
			return ERROR_STATE;

		}

	}

}








class SdlPsm {

    static START_STATE                              = 0x0;
    static SERVICE_TYPE_STATE                       = 0x02;
    static CONTROL_FRAME_INFO_STATE                 = 0x03;
    static SESSION_ID_STATE                         = 0x04;
    static DATA_SIZE_1_STATE                        = 0x05;
    static DATA_SIZE_2_STATE                        = 0x06;
    static DATA_SIZE_3_STATE                        = 0x07;
    static DATA_SIZE_4_STATE                        = 0x08;
    static MESSAGE_1_STATE                          = 0x09;
    static MESSAGE_2_STATE                          = 0x0A;
    static MESSAGE_3_STATE                          = 0x0B;
    static MESSAGE_4_STATE                          = 0x0C;
    static DATA_PUMP_STATE                          = 0x0D;
    static FINISHED_STATE                           = 0xFF;
    static ERROR_STATE                              = -1;

    static FIRST_FRAME_DATA_SIZE                    = 0x08;
    static VERSION_MASK                             = 0xF0; //4 highest bits
    static ENCRYPTION_MASK                          = 0x08; //4th lowest bit
    static FRAME_TYPE_MASK                          = 0x07; //3 lowest bits


    constructor() {
        this.reset();
    }

    reset() {
        this._state = SdlPsm.START_STATE;
        this._version = 0;
        this._encryption = false;
        this._frameType = FrameType.SINGLE;
        this._serviceType = 0;
        this._controlFrameInfo = null;
        this._sessionID = null;
        this._dumpSize = null;
        this._dataLength = 0;
        this._messageID = 0;
        this._payload = null;
	}

    getState() {
        return this._state;
    }

    getFormedPacket() {
        if (this._state === SdlPsm.FINISHED_STATE) {
            return new SdlPacket(this._version, this._encryption, this._frameType, this._serviceType, this._controlFrameInfo, this._sessionID, this._dataLength, this._messageID, this._payload);
        } else {
            return null;
        }
    }

    handleByte(data) {
        this._state = this._transitionOnInput(data, this._state);

        if (this._state == SdlPsm.ERROR_STATE) {
            return false;
        }

        return true;
	}

    _transitionOnInput(rawByte, state) {
        switch (state) {
            case SdlPsm.START_STATE:

                this._version = (rawByte&SdlPsm.VERSION_MASK)>>4;

                if (this._version == 0) {
                    return SdlPsm.ERROR_STATE;
                }
                this._encryption = (1 == (rawByte&SdlPsm.ENCRYPTION_MASK)>>3);

                this._frameType = rawByte&SdlPsm.FRAME_TYPE_MASK;

                if ((this._version < 1 || this._version > 5)
                    && this._frameType != SdlPacket.FRAME_TYPE_CONTROL) {
                    return SdlPsm.ERROR_STATE;
                }

                if (this._frameType < SdlPacket.FRAME_TYPE_CONTROL || this._frameType > SdlPacket.FRAME_TYPE_CONSECUTIVE) {
                    return SdlPsm.ERROR_STATE;
                }

                return SdlPsm.SERVICE_TYPE_STATE;

            case SdlPsm.SERVICE_TYPE_STATE:
                // TODO

            case SdlPsm.CONTROL_FRAME_INFO_STATE:
                // TODO

            case SdlPsm.SESSION_ID_STATE:
                // TODO

            case SdlPsm.DATA_SIZE_1_STATE:
                // TODO

            case SdlPsm.DATA_SIZE_2_STATE:
                // TODO

            case SdlPsm.DATA_SIZE_3_STATE:
                // TODO

            case SdlPsm.DATA_SIZE_4_STATE:
                // TODO

            case SdlPsm.MESSAGE_1_STATE:
                // TODO

            case SdlPsm.MESSAGE_2_STATE:
                // TODO

            case SdlPsm.MESSAGE_3_STATE:
                // TODO

            case SdlPsm.MESSAGE_4_STATE:
                // TODO

            case SdlPsm.DATA_PUMP_STATE:
                // TODO

            case SdlPsm.FINISHED_STATE:
            default:
                return SdlPsm.ERROR_STATE;
        }
    }

    private int transitionOnInput(byte rawByte, int state){
		switch(state){

		case SERVICE_TYPE_STATE:
			serviceType = (int)(rawByte&0xFF);
			return CONTROL_FRAME_INFO_STATE;

		case CONTROL_FRAME_INFO_STATE:
			controlFrameInfo = (int)(rawByte&0xFF);
			//Log.trace(TAG,"Frame Info: " + controlFrameInfo);
			switch(frameType){
				case SdlPacket.FRAME_TYPE_CONTROL:
					/*if(frameInfo<FRAME_INFO_HEART_BEAT
							|| (frameInfo>FRAME_INFO_END_SERVICE_ACK
									&& (frameInfo!=FRAME_INFO_SERVICE_DATA_ACK || frameInfo!=FRAME_INFO_HEART_BEAT_ACK))){
						return ERROR_STATE;
					}*/ //Although some bits are reserved...whatever
					break;
				case SdlPacket.FRAME_TYPE_SINGLE: //Fall through since they are both the same
				case SdlPacket.FRAME_TYPE_FIRST:
					if(controlFrameInfo!=0x00){
						return ERROR_STATE;
					}
					break;
				case SdlPacket.FRAME_TYPE_CONSECUTIVE:
					//It might be a good idea to check packet sequence numbers here
					break;

				default:
					return ERROR_STATE;
			}
			return SESSION_ID_STATE;

		case SESSION_ID_STATE:
			sessionId = (int)(rawByte&0xFF);
			return DATA_SIZE_1_STATE;

		case DATA_SIZE_1_STATE:
			//First data size byte
			//Log.d(TAG, "Data byte 1: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<24; //3 bytes x 8 bits
			//Log.d(TAG, "Data Size 1 : " + dataLength);
			return DATA_SIZE_2_STATE;

		case DATA_SIZE_2_STATE:
			//Log.d(TAG, "Data byte 2: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<16; //2 bytes x 8 bits
			//Log.d(TAG, "Data Size 2 : " + dataLength);
			return DATA_SIZE_3_STATE;

		case DATA_SIZE_3_STATE:
			//Log.d(TAG, "Data byte 3: " + rawByte);
			dataLength += ((int)(rawByte& 0xFF))<<8; //1 byte x 8 bits
			//Log.d(TAG, "Data Size 3 : " + dataLength);
			return DATA_SIZE_4_STATE;

		case DATA_SIZE_4_STATE:
			//Log.d(TAG, "Data byte 4: " + rawByte);
			dataLength+=((int)rawByte) & 0xFF;
			//Log.trace(TAG, "Data Size: " + dataLength);
			//We should have data length now for the pump state
			switch(frameType){ //If all is correct we should break out of this switch statement
			case SdlPacket.FRAME_TYPE_SINGLE:
			case SdlPacket.FRAME_TYPE_CONSECUTIVE:
				break;
			case SdlPacket.FRAME_TYPE_CONTROL:
				//Ok, well here's some interesting bit of knowledge. Because the start session request is from the phone with no knowledge of version it sends out
				//a v1 packet. THEREFORE there is no message id field. **** Now you know and knowing is half the battle ****
				if(version==1 && controlFrameInfo == SdlPacket.FRAME_INFO_START_SERVICE){
					if(dataLength==0){
						return FINISHED_STATE; //We are done if we don't have any payload
					}
					if(dataLength <= V1_V2_MTU_SIZE - V1_HEADER_SIZE){ // sizes from protocol/WiProProtocol.java
						payload = new byte[dataLength];
					}else{
						return ERROR_STATE;
					}
					dumpSize = dataLength;
					return DATA_PUMP_STATE;
				}
				break;

			case SdlPacket.FRAME_TYPE_FIRST:
				if(dataLength==FIRST_FRAME_DATA_SIZE){
					break;
				}
			default:
				return ERROR_STATE;
			}
			if(version==1){ //Version 1 packets will not have message id's
				if(dataLength == 0){
					return FINISHED_STATE; //We are done if we don't have any payload
				}
				if(dataLength <= V1_V2_MTU_SIZE - V1_HEADER_SIZE){ // sizes from protocol/WiProProtocol.java
					payload = new byte[dataLength];
				}else{
					return ERROR_STATE;
				}
				dumpSize = dataLength;
				return DATA_PUMP_STATE;
			}else{
				return MESSAGE_1_STATE;
			}

		case MESSAGE_1_STATE:
			messageId += ((int)(rawByte& 0xFF))<<24; //3 bytes x 8 bits
			return MESSAGE_2_STATE;

		case MESSAGE_2_STATE:
			messageId += ((int)(rawByte& 0xFF))<<16; //2 bytes x 8 bits
			return MESSAGE_3_STATE;

		case MESSAGE_3_STATE:
			messageId += ((int)(rawByte& 0xFF))<<8; //1 byte x 8 bits
			return MESSAGE_4_STATE;

		case MESSAGE_4_STATE:
			messageId+=((int)rawByte) & 0xFF;

			if(dataLength==0){
				return FINISHED_STATE; //We are done if we don't have any payload
			}
			try{
				payload = new byte[dataLength];
			}catch(OutOfMemoryError oom){
				return ERROR_STATE;
			}
			dumpSize = dataLength;
			return DATA_PUMP_STATE;

		case DATA_PUMP_STATE:
			payload[dataLength-dumpSize] = rawByte;
			dumpSize--;
			//Do we have any more bytes to read in?
			if(dumpSize>0){
				return DATA_PUMP_STATE;
			}
			else if(dumpSize==0){
				return FINISHED_STATE;
			}else{
				return ERROR_STATE;
			}
		case FINISHED_STATE: //We shouldn't be here...Should have been reset
		default:
			return ERROR_STATE;

		}

	}
}

export { SdlPsm };