import asyncio, json, aiomysql

async def main():
    pool = await aiomysql.create_pool(
        host='yesjob-mysql', port=3306, user='root', 
        password='YesJob2024!@#', db='yesjob', 
        charset='utf8mb4', autocommit=True
    )
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            with open('/app/data/jobs.jsonl', 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    try:
                        d = json.loads(line.strip())
                        resp = d.get('responsibilities', '') or ''
                        req = d.get('requirements', '') or ''
                        team = d.get('team_intro', '') or ''
                        bonus = d.get('bonus_points', '') or ''
                        tags = json.dumps(d.get('tags', []), ensure_ascii=False) if d.get('tags') else None
                        cities = json.dumps(d.get('work_cities', []), ensure_ascii=False) if d.get('work_cities') else None
                        
                        await cur.execute(
                            '''INSERT IGNORE INTO jobs 
                            (job_id, company, title, recruit_type, job_category, job_function, 
                             work_city, work_cities, team_intro, responsibilities, requirements, 
                             bonus_points, tags, publish_time, detail_url, source_page) 
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                            (str(d.get('job_id','')), d.get('company',''), d.get('title',''),
                             d.get('recruit_type',''), d.get('job_category',''), d.get('job_function',''),
                             d.get('work_city',''), cities, team, resp, req, bonus, tags,
                             d.get('publish_time',''), d.get('detail_url',''), d.get('source_page',''))
                        )
                        if (i+1) % 1000 == 0:
                            print(f'Imported {i+1}...')
                    except Exception as e:
                        print(f'Error at {i}: {e}')
                        break
            await cur.execute('SELECT COUNT(*) FROM jobs')
            r = await cur.fetchone()
            print(f'Total: {r[0]}')
            
            await cur.execute("SELECT company, title, LEFT(responsibilities, 30), LEFT(requirements, 30) FROM jobs WHERE responsibilities != '' LIMIT 1")
            row = await cur.fetchone()
            if row:
                print(f'Sample: {row[0]} | {row[1]} | Resp: {row[2]} | Req: {row[3]}')
    pool.close()
    await pool.wait_closed()

asyncio.run(main())
