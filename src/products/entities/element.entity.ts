import { Column, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company.entity";
import { ProductElement } from "./product-element.entity";
import { FormulaElement } from "./formula-element.entity";

@Entity("pro_element")
export class Element {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { 
    length: 45,
    unique: true
  })
  name: string;

  @Column('double')
  cost: number;

  @Column('double')
  stock: number;

  @Column('varchar', { 
    length: 5,
  })
  unit: string;

  // TODO: falta agregar createAt y UpdatedAt

  @Column('boolean', {
    default: true
  })
  active: boolean

  @ManyToOne(
    () => Company,
    (company) => company.element,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => ProductElement,
    (productElement) => productElement.element
  )
  productElement: ProductElement;

  @OneToMany(
    () => FormulaElement,
    (formulaElement) => formulaElement.element
  )
  formulaElement: FormulaElement;
}
