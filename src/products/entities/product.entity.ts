import { Column, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company.entity";
import { ProductElement } from "./product-element.entity";
import { ProductFormula } from "./product-formula.entity";

@Entity("pro_product")
export class Product {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { 
    length: 45,
    unique: true
  })
  name: string;

  @Column('varchar', { 
    length: 255,
    nullable: true
  })
  description: string;

  @Column('double')
  cost: number;

  @Column('double')
  price: number;

  @Column('boolean', {
    default: false
  })
  hasFormula: boolean

  // TODO: falta agregar createAt y UpdatedAt

  @Column('boolean', {
    default: true
  })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.product,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => ProductElement,
    (productFormula) => productFormula.product,
    { eager: true }
  )
  productElement: ProductElement[];

  @OneToMany(
    () => ProductFormula,
    (productFormula) => productFormula.product,
    { eager: true }
  )
  productFormula: ProductFormula[];
}
