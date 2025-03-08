import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Company, ProductElement, FormulaElement, ElementType } from "./";

@Entity("pro_element")
export class Element {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  name: string;

  @Column('varchar', { length: 100, nullable: true })
  description: string;

  @Column('double')
  cost: number;

  @Column('double')
  stock: number;

  @Column('varchar', { length: 5 })
  unit: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column('boolean', { default: true })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.element,
    { eager: true }
  )
  company: Company;

  @ManyToOne(
    () => ElementType,
    (elementType) => elementType.element,
    { eager: true }
  )
  elementType: ElementType;

  @OneToMany(
    () => ProductElement,
    (productElement) => productElement.element
  )
  productElement: ProductElement[];

  @OneToMany(
    () => FormulaElement,
    (formulaElement) => formulaElement.element
  )
  formulaElement: FormulaElement[];

}
