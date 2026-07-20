import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError & { code?: string; errno?: number }, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isDuplicate =
      exception.code === 'ER_DUP_ENTRY' ||
      exception.errno === 1062 ||
      exception.message?.includes('Duplicate entry');

    if (isDuplicate) {
      let message = 'Dữ liệu đã tồn tại trong hệ thống (trùng lặp thông tin).';
      if (exception.message?.includes('users') || exception.message?.includes('email') || exception.message?.includes('IDX_97672ac88f789774dd47f7c8be')) {
        message = 'Email đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.';
      } else if (exception.message?.includes('warehouses') || exception.message?.includes('code')) {
        message = 'Mã kho hàng đã tồn tại.';
      } else if (exception.message?.includes('products')) {
        message = 'Mã sản phẩm (SKU) hoặc barcode đã tồn tại.';
      }

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Bad Request',
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message || 'Lỗi cơ sở dữ liệu',
      error: 'Internal Server Error',
    });
  }
}
