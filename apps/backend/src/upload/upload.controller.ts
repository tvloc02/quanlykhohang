import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { CloudinaryService } from './cloudinary.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh để tải lên');
    }
    const result = await this.cloudinaryService.uploadImage(file);
    return {
      success: true,
      url: result.url,
      publicId: result.public_id,
      message: 'Tải ảnh lên Cloudinary thành công',
    };
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một hình ảnh');
    }
    const results = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file)),
    );
    return {
      success: true,
      data: results.map((r) => ({ url: r.url, publicId: r.public_id })),
      urls: results.map((r) => r.url),
      message: `Đã tải ${results.length} hình ảnh lên Cloudinary thành công`,
    };
  }
}
