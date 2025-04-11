import { DataTypes, Sequelize, Model } from "sequelize";
import sequelize from "./db.ts";
import toml from "toml";
import fs from "node:fs";

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  coins: number;
  ram: number;
  disk: number;
  cpu: number;
  allocations: number;
  databases: number;
  backups: number;
  slots: number;
  servers: number;
  isSuspended: boolean;
  googleId: number | null;
}

// For creation - typically excludes auto-increment fields
interface UserCreationAttributes extends Omit<UserAttributes, "id"> {}

// Define the User model class
class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public coins!: number;
  public ram!: number;
  public disk!: number;
  public cpu!: number;
  public allocations!: number;
  public databases!: number;
  public backups!: number;
  public slots!: number;
  public servers!: number;
  public googleId!: number | null;
}

const config = toml.parse(
  fs.readFileSync(process.cwd() + "/config.toml", "utf-8")
);

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    coins: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    ram: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.ram,
    },
    disk: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.disk,
    },
    cpu: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.cpu,
    },
    allocations: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.allocations,
    },
    databases: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.database,
    },
    backups: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.backup,
    },
    slots: {
      type: DataTypes.INTEGER,
      defaultValue: config.Resources.slots,
    },
    servers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lastLoggedInFrom: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    googleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "users",
    modelName: "User",
  }
);

// Synchronize the model with the database
User.sync();

export default User;
