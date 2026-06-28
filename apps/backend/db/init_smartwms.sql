-- Init database and user
CREATE DATABASE IF NOT EXISTS `smart_wms` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'tvloc02'@'localhost' IDENTIFIED BY '123456';
CREATE USER IF NOT EXISTS 'tvloc02'@'127.0.0.1' IDENTIFIED BY '123456';
CREATE USER IF NOT EXISTS 'tvloc02'@'%' IDENTIFIED BY '123456';
GRANT ALL PRIVILEGES ON `smart_wms`.* TO 'tvloc02'@'localhost';
GRANT ALL PRIVILEGES ON `smart_wms`.* TO 'tvloc02'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `smart_wms`.* TO 'tvloc02'@'%';
FLUSH PRIVILEGES;

USE `smart_wms`;

-- Roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `fullName` varchar(255) NULL,
  `phone` varchar(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles join
CREATE TABLE IF NOT EXISTS `user_roles` (
  `userId` bigint NOT NULL,
  `roleId` bigint NOT NULL,
  PRIMARY KEY (`userId`,`roleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suppliers
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products
CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `internalSku` varchar(255) NOT NULL,
  `supplierBarcode` varchar(255) NULL,
  `name` varchar(255) NOT NULL,
  `unit` varchar(255) NULL,
  `categoryId` bigint NULL,
  `minimumStock` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_products_internalSku` (`internalSku`),
  KEY `IDX_products_categoryId` (`categoryId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inbound receipts (purchase orders)
CREATE TABLE IF NOT EXISTS `inbound_receipts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `supplierId` bigint NULL,
  `expectedDate` datetime NULL,
  `status` varchar(255) NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_inbound_receipts_supplierId` (`supplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outbound orders
CREATE TABLE IF NOT EXISTS `outbound_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customerId` bigint NULL,
  `expectedDate` datetime NULL,
  `status` varchar(255) NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_outbound_orders_customerId` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inbound details
CREATE TABLE IF NOT EXISTS `inbound_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inboundReceiptId` bigint NOT NULL,
  `productId` bigint NOT NULL,
  `expectedQty` int NOT NULL DEFAULT 0,
  `receivedQty` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `IDX_inbound_details_inboundReceiptId` (`inboundReceiptId`),
  KEY `IDX_inbound_details_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outbound details
CREATE TABLE IF NOT EXISTS `outbound_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `outboundOrderId` bigint NOT NULL,
  `productId` bigint NOT NULL,
  `requiredQty` int NOT NULL DEFAULT 0,
  `pickedQty` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `IDX_outbound_details_outboundOrderId` (`outboundOrderId`),
  KEY `IDX_outbound_details_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Picking tasks
CREATE TABLE IF NOT EXISTS `picking_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `orderId` bigint NOT NULL,
  `assignedTo` varchar(255) NULL,
  `status` varchar(255) NOT NULL DEFAULT 'OPEN',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_picking_tasks_orderId` (`orderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock balances
CREATE TABLE IF NOT EXISTS `stock_balances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `productId` bigint NOT NULL,
  `locationCode` varchar(255) NOT NULL,
  `totalPhysical` int NOT NULL DEFAULT 0,
  `allocated` int NOT NULL DEFAULT 0,
  `available` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_stock_balances_product_location` (`productId`,`locationCode`),
  KEY `IDX_stock_balances_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Warehouses
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` varchar(64) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` varchar(500) NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `managerIds` text NOT NULL,
  `staffIds` text NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_warehouses_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock in orders
CREATE TABLE IF NOT EXISTS `stock_in_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `orderCode` varchar(255) NOT NULL,
  `sourcePurchaseOrderId` bigint NULL,
  `sourcePurchaseOrderNo` varchar(255) NULL,
  `status` varchar(255) NOT NULL DEFAULT 'DRAFT',
  `currentStepUserId` varchar(255) NULL,
  `currentStepUserEmail` varchar(255) NULL,
  `note` text NULL,
  `completedAt` datetime NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_stock_in_orders_orderCode` (`orderCode`),
  KEY `IDX_stock_in_orders_sourcePurchaseOrderId` (`sourcePurchaseOrderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_in_order_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stockInOrderId` bigint NOT NULL,
  `productId` bigint NOT NULL,
  `warehouseCode` varchar(255) NULL,
  `requestedQty` int NOT NULL DEFAULT 0,
  `actualQty` int NOT NULL DEFAULT 0,
  `unitPrice` decimal(15,2) NOT NULL DEFAULT 0,
  `totalLineAmount` decimal(15,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `IDX_stock_in_order_details_stockInOrderId` (`stockInOrderId`),
  KEY `IDX_stock_in_order_details_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock in receipts
CREATE TABLE IF NOT EXISTS `stock_in_receipts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `receiptCode` varchar(255) NOT NULL,
  `receiptType` varchar(255) NOT NULL DEFAULT 'PURCHASE_GOODS',
  `warehouseCode` varchar(255) NULL,
  `supplierId` bigint NULL,
  `sourceStockInOrderId` bigint NULL,
  `sourceReferenceNo` varchar(255) NULL,
  `receiptDate` datetime NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'DRAFT',
  `description` text NULL,
  `totalAmount` decimal(15,2) NOT NULL DEFAULT 0,
  `postedAt` datetime NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_stock_in_receipts_receiptCode` (`receiptCode`),
  KEY `IDX_stock_in_receipts_supplierId` (`supplierId`),
  KEY `IDX_stock_in_receipts_sourceStockInOrderId` (`sourceStockInOrderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_in_receipt_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `receiptId` bigint NOT NULL,
  `productId` bigint NOT NULL,
  `warehouseCode` varchar(255) NULL,
  `quantity` int NOT NULL DEFAULT 0,
  `unitPrice` decimal(15,2) NOT NULL DEFAULT 0,
  `totalLineAmount` decimal(15,2) NOT NULL DEFAULT 0,
  `note` text NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_stock_in_receipt_details_receiptId` (`receiptId`),
  KEY `IDX_stock_in_receipt_details_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `user_roles` ADD CONSTRAINT `FK_user_roles_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `user_roles` ADD CONSTRAINT `FK_user_roles_role` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `products` ADD CONSTRAINT `FK_products_category` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `inbound_receipts` ADD CONSTRAINT `FK_inbound_receipts_supplier` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `outbound_orders` ADD CONSTRAINT `FK_outbound_orders_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `inbound_details` ADD CONSTRAINT `FK_inbound_details_inboundReceipt` FOREIGN KEY (`inboundReceiptId`) REFERENCES `inbound_receipts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `inbound_details` ADD CONSTRAINT `FK_inbound_details_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `outbound_details` ADD CONSTRAINT `FK_outbound_details_outboundOrder` FOREIGN KEY (`outboundOrderId`) REFERENCES `outbound_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `outbound_details` ADD CONSTRAINT `FK_outbound_details_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `picking_tasks` ADD CONSTRAINT `FK_picking_tasks_order` FOREIGN KEY (`orderId`) REFERENCES `outbound_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `stock_balances` ADD CONSTRAINT `FK_stock_balances_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `stock_in_orders` ADD CONSTRAINT `FK_stock_in_orders_sourcePurchaseOrder` FOREIGN KEY (`sourcePurchaseOrderId`) REFERENCES `inbound_receipts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `stock_in_order_details` ADD CONSTRAINT `FK_stock_in_order_details_stockInOrder` FOREIGN KEY (`stockInOrderId`) REFERENCES `stock_in_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `stock_in_order_details` ADD CONSTRAINT `FK_stock_in_order_details_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `stock_in_receipts` ADD CONSTRAINT `FK_stock_in_receipts_supplier` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `stock_in_receipts` ADD CONSTRAINT `FK_stock_in_receipts_sourceStockInOrder` FOREIGN KEY (`sourceStockInOrderId`) REFERENCES `stock_in_orders`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `stock_in_receipt_details` ADD CONSTRAINT `FK_stock_in_receipt_details_receipt` FOREIGN KEY (`receiptId`) REFERENCES `stock_in_receipts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `stock_in_receipt_details` ADD CONSTRAINT `FK_stock_in_receipt_details_product` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Done
