export interface ICustomer {
  name: string;
  email: string;
  password: string;
}

declare global {
  namespace Express {
    export interface Request {
      admin?: any;
      customer?: any;
    }
  }
}
