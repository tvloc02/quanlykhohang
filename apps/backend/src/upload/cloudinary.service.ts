import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || process.env.CLOUDINARY_CLOUD_NAME || 'dkjxd1qdx';
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY') || process.env.CLOUDINARY_API_KEY || '537498332822245';
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET') || process.env.CLOUDINARY_API_SECRET || 'tS_vH6KP9uO6-E-wYLAWGQ48PBE';

    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL') || process.env.CLOUDINARY_URL;
    if (cloudinaryUrl && !cloudinaryUrl.includes('<your_api_key>')) {
      cloudinary.config({
        cloudinary_url: cloudinaryUrl,
        secure: true,
      });
    } else {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  /**
   * Upload image buffer/file stream to Cloudinary
   * Returns secure_url to store into MySQL Database
   */
  async uploadImage(file: Express.Multer.File, folder: string = 'smart_wms'): Promise<{ url: string; public_id: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh hợp lệ.');
    }

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || process.env.CLOUDINARY_CLOUD_NAME || 'dkjxd1qdx';
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY') || process.env.CLOUDINARY_API_KEY || '537498332822245';
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET') || process.env.CLOUDINARY_API_SECRET || 'tS_vH6KP9uO6-E-wYLAWGQ48PBE';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    try {
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype || 'image/png'};base64,${b64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: folder,
        resource_type: 'image',
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error: any) {
      throw new BadRequestException(`Lỗi khi tải ảnh lên Cloudinary: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Delete an image from Cloudinary by its public_id
   */
  async deleteImage(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}
