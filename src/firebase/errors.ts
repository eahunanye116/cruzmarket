export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;
  constructor(context: SecurityRuleContext) {
    const { path, operation } = context;
    const message = `FirestoreError: Missing or insufficient permissions for ${operation} on ${path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}
