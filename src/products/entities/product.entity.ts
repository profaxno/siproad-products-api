import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Company, ProductElement, ProductFormula, ProductType } from "./";

@Entity("pro_product")
export class Product {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  name: string;

  @Column('varchar', { length: 100, nullable: true })
  description: string;

  @Column('double')
  cost: number;

  @Column('double')
  price: number;

  @Column('varchar', { length: 255, nullable: true })
  imagenUrl: string;

  @Column('boolean', { default: false })
  hasFormula: boolean

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column('boolean', { default: true })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.product,
    { eager: true }
  )
  company: Company;

  @ManyToOne(
    () => ProductType,
    (productType) => productType.product,
    { eager: true }
  )
  productType: ProductType;
  
  @OneToMany(
    () => ProductElement,
    (productElement) => productElement.product,
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
