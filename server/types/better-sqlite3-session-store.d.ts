declare module "better-sqlite3-session-store" {
  import session from "express-session";

  interface BetterSqlite3SessionStoreOptions {
    client: any;
    expired?: {
      clear?: boolean;
      intervalMs?: number;
    };
  }

  function factory(s: typeof session): new (opts: BetterSqlite3SessionStoreOptions) => session.Store;
  export default factory;
}
