import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';
//tao tai khoan khach hang
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const usersService = app.get(UsersService);
  const customerRepo = app.get<Repository<Customer>>(getRepositoryToken(Customer));

  console.log('Đang tạo tài khoản khách hàng mẫu...');

  try {
    // 1. Kiểm tra xem user đã tồn tại chưa
    const existingUser = await usersService.findByEmail('customer@example.com');
    if (existingUser) {
      console.log('Tài khoản customer@example.com đã tồn tại!');
      process.exit(0);
    }

    // 2. Tạo User account với role 'customer'
    const user = await usersService.create({
      email: 'customer@example.com',
      password: 'Customer@123',
      fullName: 'Khách hàng VIP',
      role: 'customer'
    });
    console.log(`Đã tạo User thành công (ID: ${user.id})`);

    // 3. Tạo Customer profile liên kết với User account đó
    const customer = customerRepo.create({
      customerCode: 'KH001',
      name: 'Công ty Cổ phần Mua Sắm VN',
      email: 'customer@example.com',
      phone: '0987654321',
      address: '123 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
      type: 'B2B',
      status: 'active',
      contactPerson: 'Anh Tuấn',
      user: user
    });
    await customerRepo.save(customer);

    console.log('==============================================');
    console.log('TẠO TÀI KHOẢN KHÁCH HÀNG THÀNH CÔNG!');
    console.log('Email đăng nhập : customer@example.com');
    console.log('Mật khẩu        : Customer@123');
    console.log('==============================================');

  } catch (error) {
    console.error('Lỗi khi tạo tài khoản:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
