import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Element, Formula, Product } from "./";
import { ProductType } from "./product-type.entity";

@Entity("pro_company")
export class Company {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50, unique: true })
  name: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
  
  @Column('boolean', { default: true })
  active: boolean

  @OneToMany(
    () => Element,
    (element) => element.company
  )
  element: Element;

  @OneToMany(
    () => Formula,
    (formula) => formula.company
  )
  formula: Formula;

  @OneToMany(
    () => Product,
    (product) => product.company
  )
  product: Product;

  @OneToMany(
    () => ProductType,
    (productType) => productType.company
  )
  productType: ProductType;
}
