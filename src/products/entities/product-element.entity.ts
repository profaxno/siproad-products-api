import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product, Element } from "./";

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
    () => Element,
    (element) => element.productElement,
    { eager: true }
  )
  element: Element;
}
