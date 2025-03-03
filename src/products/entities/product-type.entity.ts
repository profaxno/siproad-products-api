import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Company, Product } from "./";

@Entity("pro_product_type")
export class ProductType {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 45, unique: true })
  label: string;

  @ManyToOne(
    () => Company,
    (company) => company.product,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => Product,
    (product) => product.productType
  )
  product: Product;

}
