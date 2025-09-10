import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "src/products/companies/entities/company.entity";
import { Product } from "./product.entity";


@Entity("pro_product_unit")
export class ProductUnit {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  name: string;

  @Column('boolean', { default: true })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.productUnit,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => Product,
    (product) => product.productUnit
  )
  product: Product;

}
