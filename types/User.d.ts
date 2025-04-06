import Sequelize from "sequelize";

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
}

interface UserInstance extends UserAttributes {
  getDataValue(key: keyof UserAttributes): any;
  setDataValue(key: keyof UserAttributes, value: any): void;
}

interface UserModel extends Sequelize.Model<UserInstance, UserAttributes> {
  // Add any custom methods or static methods here
}
