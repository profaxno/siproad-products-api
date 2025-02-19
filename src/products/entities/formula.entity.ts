import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company.entity";
import { FormulaElement } from "./formula-element.entity";
import { ProductFormula } from "./product-formula.entity";

@Entity("pro_formula")
export class Formula {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { 
    length: 45,
    unique: true
  })
  name: string;

  @Column('double')
  cost: number;

  // TODO: falta agregar createAt y UpdatedAt

  @Column('boolean', {
    default: true
  })
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
