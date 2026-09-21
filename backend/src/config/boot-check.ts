// Side-effect import: runs the production config assertion at module-evaluation time. Import this
// immediately after 'dotenv/config' (and before AppModule) in every entry point, so the operator
// sees ONE complete list of config problems instead of whichever module-level check
// (auth.module.ts, key-encryption.util.ts) happens to throw first.
import { assertProductionConfig } from './production-config';

assertProductionConfig();
