import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Company, FormulaElement, ProductFormula } from "./";

@Entity("pro_formula")
export class Formula {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  name: string;

  @Column('double')
  cost: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column('boolean', { default: true })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.formula,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => FormulaElement,
    (formulaElement) => formulaElement.formula,
    { eager: true }
  )
  formulaElement: FormulaElement[];

  @OneToMany(
    () => ProductFormula,
    (productFormula) => productFormula.product
  )
  productFormula: ProductFormula;
}
