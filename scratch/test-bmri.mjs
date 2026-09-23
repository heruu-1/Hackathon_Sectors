import fs from 'fs';

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}

async function run() {
  const { fetchDailyPrices } = await import('../lib/server/providers/sectors.ts');
  const res = await fetchDailyPrices('BMRI');
  console.log('BMRI Daily Prices length:', res.data?.length);
  if (res.data?.length) {
    fs.writeFileSync('scratch/bmri_sectors_daily.json', JSON.stringify(res.data, null, 2));
    console.log('Saved Sectors daily prices to scratch/bmri_sectors_daily.json');
  }
}

run().catch(console.error);
