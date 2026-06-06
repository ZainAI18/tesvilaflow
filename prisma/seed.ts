import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@tesvila.local" },
    update: {},
    create: {
      name: "Tesvila Admin",
      email: "admin@tesvila.local",
      passwordHash: "replace-with-real-hash",
      role: "ADMIN"
    }
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { name: "Main Warehouse" },
    update: {},
    create: { name: "Main Warehouse" }
  });

  const category = await prisma.category.upsert({
    where: { name: "Toilet Bowl" },
    update: {},
    create: { name: "Toilet Bowl" }
  });

  const supplier = await prisma.supplier.create({
    data: {
      supplierName: "Guangzhou Sanitary Supply",
      contactPerson: "Ms Chen",
      currency: "RMB",
      paymentTerm: "Deposit + balance"
    }
  });

  const product = await prisma.product.upsert({
    where: { productCode: "TB-9001" },
    update: {},
    create: {
      productCode: "TB-9001",
      productName: "One Piece Toilet Bowl",
      brand: "Tesvila",
      categoryId: category.id,
      supplierId: supplier.id,
      weightedAverageCost: 148.25,
      latestLandedCost: 148.25,
      dealerPrice: 260,
      retailPrice: 338,
      sellingPrice: 260,
      minimumStockAlert: 10
    }
  });

  await prisma.productWarehouseStock.upsert({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    update: { currentStock: 38 },
    create: {
      productId: product.id,
      warehouseId: warehouse.id,
      currentStock: 38
    }
  });

  await prisma.product.update({
    where: { id: product.id },
    data: { totalCurrentStock: 38 }
  });

  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      module: "seed",
      action: "create",
      description: "Initial Tesvila MVP seed data"
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
