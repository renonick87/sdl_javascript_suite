/*
 * Copyright (c) 2019 Livio, Inc.
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

import { SdlFile } from './SdlFile';
import { FileType } from './../../../rpc/enums/FileType.js';
import { ImageType } from './../../../rpc/enums/ImageType.js';
import { Image } from './../../../rpc/structs/Image.js';

class SdlArtwork extends SdlFile {
    constructor (fileName, fileType, data, persistentFile) {
        super(fileName, fileType, data, persistentFile);
        this._isTemplate = null;
        this._imageRPC = null;
    }

    /**
     * Sets whether this SdlArtwork is a template image whose coloring should be decided by the HMI
     * @param {Boolean} isTemplate - boolean that tells whether this SdlArtwork is a template image
     */
    setTemplateImage (isTemplate) {
        this._isTemplate = isTemplate;
    }

    /**
     * Gets whether this SdlArtwork is a template image whose coloring should be decided by the HMI
     * @return {Boolean} - tells whether this SdlArtwork is a template image
     */
    isTemplateImage () {
        return this._isTemplate;
    }

    /**
     * @param {FileType} fileType
     */
    setType (fileType) {
        if (fileType === null || fileType.equals(FileType.GRAPHIC_JPEG) || fileType.equals(FileType.GRAPHIC_PNG)
                || fileType.equals(FileType.GRAPHIC_BMP)) {
            super.setType(fileType);
        } else {
            throw new Error('Only JPEG, PNG, and BMP image types are supported.');
        }
    }

    /**
     * Gets the Image RPC representing this artwork. Generally for use internally, you should instead pass an artwork to a Screen Manager method
     * @return {Image} - The Image RPC representing this artwork.
     */
    getImageRPC () {
        if (this._imageRPC === null) {
            this._imageRPC = this._createImageRPC();
        }
        return this._imageRPC;
    }

    /**
     * @return {Image} - The Image RPC representing this artwork.
     */
    _createImageRPC () {
        let image;
        if (this.isStaticIcon()) {
            image = new Image(this.getName(), ImageType.STATIC);
            image.setIsTemplate(true);
        } else {
            image = new Image(this.getName(), ImageType.DYNAMIC);
            image.setIsTemplate(this._isTemplate);
        }
        return image;
    }
}

export { SdlArtwork };