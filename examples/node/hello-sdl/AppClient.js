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

const fs = require('fs');
const SDL = require('../../../lib/node/dist/index.js');
const CONFIG = require('./config.js');

class AppClient {
    constructor (wsClient) {
        // TODO: setAppIcon(SdlArtwork)
        this._appConfig = new SDL.manager.AppConfig()
            .setAppId(CONFIG.appId)
            .setAppName(CONFIG.appName)
            .setIsMediaApp(false)
            .setLanguageDesired(SDL.rpc.enums.Language.EN_US)
            .setHmiDisplayLanguageDesired(SDL.rpc.enums.Language.EN_US)
            .setAppTypes([
                SDL.rpc.enums.AppHMIType.DEFAULT,
            ])
            .setTransportConfig(
                new SDL.transport.WebSocketServerConfig(
                    wsClient,
                    CONFIG.connectionLostTimeout
                )
            );

        const managerListener = new SDL.manager.SdlManagerListener();
        managerListener.setOnStart((sdlManager) => {
            this._onConnected();
        });

        this._sdlManager = new SDL.manager.SdlManager(this._appConfig, managerListener);
        this._sdlManager
            .start()
            .addRpcListener(SDL.rpc.enums.FunctionID.OnHMIStatus, function (message) {
                this._onHmiStatusListener(message);
            }.bind(this));
    }

    async _onConnected () {
        // app starts in the NONE state
        const fileBinary = await _fetchImageUnit8Array('./test_icon_1.png');
        const fileName = `${this._appConfig.getAppId()}_icon.gif`;

        const putFile = new SDL.rpc.messages.PutFile()
            .setFileName(fileName)
            .setFileType('GRAPHIC_PNG')
            .setPersistentFile(true)
            .setFileData(fileBinary);

        const setAppIcon = new SDL.rpc.messages.SetAppIcon()
            .setFileName(fileName);

        await this._sdlManager.sendSequentialRpcs([
            putFile,
            setAppIcon,
        ]);
    }

    async _onHmiStatusListener (onHmiStatus) {
        const hmiLevel = onHmiStatus.getHMILevel();

        // wait for the FULL state for more functionality
        if (hmiLevel === SDL.rpc.enums.HMILevel.HMI_FULL) {
            const show = new SDL.rpc.messages.Show();
            show.setMainField1('Hello')
                .setMainField2('こんにちは')
                .setMainField3('你好');

            await this._sdlManager.sendRpc(show);

            await this._sleep(2000);

            const count = 3;
            for (let i = 0; i < count; i++) {
                const showCountdown = new SDL.rpc.messages.Show();
                showCountdown.setMainField1(`Exiting in ${(count - i).toString()}`)
                    .setMainField2('')
                    .setMainField3('');

                this._sdlManager.sendRpc(showCountdown); // don't wait for a response

                await this._sleep();
            }

            // tear down the app
            await this._sdlManager.sendRpc(new SDL.rpc.messages.UnregisterAppInterface());

            this._sdlManager.dispose();
        }
    }

    async _sleep (timeout = 1000) {
        return new Promise((resolve) => {
            setTimeout(resolve, timeout);
        });
    }
}

async function _fetchImageUnit8Array (path) {
    const aryBuffer = fs.readFileSync(path, null);
    return new Uint8Array(aryBuffer);
}

module.exports = AppClient;