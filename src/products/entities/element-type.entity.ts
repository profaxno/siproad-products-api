import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Company, Element } from "./";

@Entity("pro_element_type")
export class ElementType {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 45, unique: true })
  label: string;

  @ManyToOne(
    () => Company,
    (company) => company.product,
    { eager: true }
  )
  company: Company;

  @OneToMany(
    () => Element,
    (element) => element.elementType
  )
  element: Element;

}
