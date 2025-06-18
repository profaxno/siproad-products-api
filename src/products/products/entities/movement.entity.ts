import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Product } from "./product.entity";
import { User } from "src/products/users/entities/user.entity";

@Entity("pro_movement")
export class Movement {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('tinyint', { default: 1, unsigned: true })
  type: number;

  @Column('tinyint', { default: 1, unsigned: true })
  reason: number;

  @Column('double')
  qty: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column('boolean', { default: true })
  active: boolean

  @Column('varchar', { length: 100 })
  relatedId: string;

  @ManyToOne(
    () => Product,
    (product) => product.movement,
    { eager: true }
  )
  product: Product;

  @ManyToOne(
    () => User,
    (user) => user.movement,
    { eager: true }
  )
  user: User;

}
