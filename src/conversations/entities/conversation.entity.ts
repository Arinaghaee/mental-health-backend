import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import {
  ConversationCategory,
  ConversationUrgency,
  ConversationStatus,
} from '../../common/enums/conversation.enum';
import { User } from '../../users/entities/user.entity';
import { Message } from '../../messages/entities/message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  conversation_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ default: false })
  is_anonymous: boolean;

  @Column({
    type: 'varchar',
    length:30,
  })
  category: ConversationCategory;

  @Column({
    type: 'varchar',
    length:30,
    default: ConversationUrgency.MEDIUM,
  })
  urgency: ConversationUrgency;

  @Column({
    type: 'varchar',
    length:30,
    default: ConversationStatus.NEW,
  })
  status: ConversationStatus;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.conversations)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  counselor: User;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
