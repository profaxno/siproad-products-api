import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Formula, Element } from "./";

@Entity("pro_formula_element")
export class FormulaElement {
  
  @PrimaryGeneratedColumn()
  id: number;

  @Column('double')
  qty: number;

  @ManyToOne(
    () => Formula,
    (formula) => formula.formulaElement
  )
  formula: Formula;

  @ManyToOne(
    () => Element,
    (element) => element.formulaElement,
    { eager: true }
  )
  element: Element;
}
