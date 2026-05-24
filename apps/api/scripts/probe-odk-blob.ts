import { config } from 'dotenv';
import { query } from '@gabi/db';
import { getConnectionPool, getDefaultConnectionId } from '../src/services/connections.js';

config({ path: '.env' });

async function main() {
  const id = await getDefaultConnectionId();
  const pool = await getConnectionPool(id);
  const tables = [
    '_form_info',
    '_form_info_fileset',
    '_form_info_xform_bin',
    '_form_info_xform_ref',
    '_form_info_xform_blb',
    '_form_data_model',
    '_form_info_submission_association',
  ];
  for (const t of tables) {
    const cols = await query<{ column_name: string; data_type: string }>(
      pool,
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'odk_prod' AND table_name = $1 ORDER BY ordinal_position`,
      [t],
    );
    console.log('\n##', t);
    for (const c of cols) console.log(' ', c.column_name, c.data_type);
  }
  const forms = await query(pool, `SELECT "_URI", "FORM_ID" FROM odk_prod._form_info LIMIT 2`);
  console.log('\nforms:', forms);
  const fs = await query(pool, `SELECT * FROM odk_prod._form_info_fileset LIMIT 2`);
  console.log('\nfileset:', fs);

  const formUri = 'md5:c89787272add784d8244017e6d1ef0ea';
  const bins = await query(
    pool,
    `SELECT "_URI", "_PARENT_AURI", "CONTENT_TYPE", "CONTENT_LENGTH"
     FROM odk_prod._form_info_xform_bin
     WHERE "_TOP_LEVEL_AURI" = $1 OR "_PARENT_AURI" = $1
     LIMIT 5`,
    [formUri],
  );
  console.log('\nxform bins for laudov1:', bins);

  if (bins[0]) {
    const binUri = (bins[0] as { _URI: string })._URI;
    const refs = await query(
      pool,
      `SELECT "_DOM_AURI", "_SUB_AURI", "PART" FROM odk_prod._form_info_xform_ref
       WHERE "_DOM_AURI" = $1 ORDER BY "PART" LIMIT 5`,
      [binUri],
    );
    console.log('\nrefs:', refs);
    if (refs[0]) {
      const blb = await query(
        pool,
        `SELECT length("VALUE") AS len, left(convert_from("VALUE", 'UTF8'), 200) AS preview
         FROM odk_prod._form_info_xform_blb WHERE "_URI" = $1`,
        [(refs[0] as { _SUB_AURI: string })._SUB_AURI],
      );
      console.log('\nblb preview:', blb);
    }
  }

  const model = await query(
    pool,
    `SELECT "URI_SUBMISSION_DATA_MODEL", "ELEMENT_NAME", "PERSIST_AS_COLUMN_NAME", "PERSIST_AS_TABLE_NAME"
     FROM odk_prod._form_data_model
     WHERE "PERSIST_AS_TABLE_NAME" IS NOT NULL
     LIMIT 10`,
  );
  console.log('\ndata model sample:', model);
}

main().catch(console.error).finally(() => process.exit(0));
