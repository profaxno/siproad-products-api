import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from ".";

@Entity("pro_product_element")
export class ProductElement {
  
  @PrimaryGeneratedColumn()
  id: number;

  @Column('double')
  qty: number;
  
  @ManyToOne(
    () => Product,
    (product) => product.productElement,
  )
  product: Product;

  @ManyToOne(
    () => Product,
    (product) => product.productElement
  )
  element: Product;
}
