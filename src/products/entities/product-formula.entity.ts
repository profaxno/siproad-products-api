import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product, Formula } from "./";

@Entity("pro_product_formula")
export class ProductFormula {
  
  @PrimaryGeneratedColumn()
  id: number;

  @Column('double')
  qty: number;
  
  @ManyToOne(
    () => Product,
    (product) => product.productFormula,
  )
  product: Product;

  @ManyToOne(
    () => Formula,
    (formula) => formula.productFormula,
    { eager: true }
  )
  formula: Formula;
}
