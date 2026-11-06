const fs = require('fs');

let code = fs.readFileSync('functions/api/[[route]].js', 'utf8');

// 1. In /api/company/:id
const targetPromiseAll = `        systemThemeRes,\r\n      ] = await Promise.all([`;
const replacePromiseAll = `        systemThemeRes,\r\n        landmarksRes,\r\n      ] = await Promise.all([`;

const target1 = `        db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(companyId).first().catch(() => null),\r\n      ]);`;
const replace1 = `        db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(companyId).first().catch(() => null),\r\n        db.prepare('SELECT * FROM landmarks WHERE company_id = ? ORDER BY branch_id ASC, id ASC').bind(companyId).all().catch(() => ({ results: [] })),\r\n      ]);`;

const target2 = `        system_theme: systemThemeRes || null,\r\n      });`;
const replace2 = `        system_theme: systemThemeRes || null,\r\n        landmarks: landmarksRes?.results || [],\r\n      });`;

code = code.replace(targetPromiseAll, replacePromiseAll);
code = code.replace(target1, replace1);
code = code.replace(target2, replace2);

// 2. Insert Landmarks & Coverage Areas endpoint
const target3 = `    // 6. Branches endpoint: read and write on D1 table 'branches'`;
const landmarksEndpoint = `    // 5.B Landmarks / Address/Landmark Settings endpoint: read & write on D1 table 'landmarks'
    if (
      path === 'landmarks' ||
      path.startsWith('landmarks/') ||
      path === 'address-landmarks' ||
      path.startsWith('address-landmarks/') ||
      path === 'coverage-areas' ||
      path.startsWith('coverage-areas/')
    ) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const branchIdParam = url.searchParams.get('branch_id');
      const idMatch = path.match(/^landmarks\\/(\\d+)$/) || path.match(/^address-landmarks\\/(\\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      const ensureLandmarksTable = async () => {
        try {
          await db.prepare(\`
            CREATE TABLE IF NOT EXISTS landmarks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              branch_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
          \`).run();
        } catch (e) {
          console.warn('Landmarks table create error:', e);
        }

        try {
          await db.prepare(\`
            CREATE INDEX IF NOT EXISTS idx_landmarks_branch ON landmarks(company_id, branch_id)
          \`).run();
        } catch (e) {}

        // Auto-seed initial landmarks if table is empty
        try {
          const countRes = await db.prepare('SELECT count(*) as count FROM landmarks WHERE company_id = ?').bind(companyId).first().catch(() => null);
          if (!countRes || Number(countRes.count) === 0) {
            // Seed Butwal landmarks for branch 1
            const defaultLm = [
              'Traffic Chowk',
              'Milanchowk',
              'Golpark',
              'Belbas',
              'Kalikanagar',
              'Hospital Line',
            ];
            for (const name of defaultLm) {
              await db.prepare(\`
                INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                VALUES (?, 1, ?, datetime('now'), datetime('now'))
              \`).bind(companyId, name).run().catch(() => {});
            }

            // Find Aurahi / Mahottari branches and seed their coverage areas
            const aurahiBranches = await db.prepare(\`
              SELECT id, name FROM branches WHERE name LIKE '%Aurahi%' OR name LIKE '%Aaurahi%' OR (district LIKE '%Mahottari%' AND (name LIKE '%Aurahi%' OR name LIKE '%Aaurahi%'))
            \`).all().catch(() => ({ results: [] }));

            const aurahiCoverage = [
              'Aaurahi Mahottari',
              'Aurahi Mahorati',
              'Aurahi Bazar',
            ];

            if (aurahiBranches?.results?.length) {
              for (const br of aurahiBranches.results) {
                for (const lm of aurahiCoverage) {
                  await db.prepare(\`
                    INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                    VALUES (?, ?, ?, datetime('now'), datetime('now'))
                  \`).bind(companyId, Number(br.id), lm).run().catch(() => {});
                }
              }
            }
          }
        } catch (e) {
          console.warn('Landmarks seed error:', e);
        }
      };

      await ensureLandmarksTable();

      // Coverage areas helper endpoint
      if (path === 'coverage-areas' || path.startsWith('coverage-areas/')) {
        const bId = Number(branchIdParam || path.split('/')[1] || 0);
        if (!bId) {
          return jsonResponse({ success: false, coverage_areas: [], message: 'branch_id required' });
        }

        let { results } = await db.prepare(
          'SELECT * FROM landmarks WHERE company_id = ? AND branch_id = ? ORDER BY id ASC'
        ).bind(companyId, bId).all();

        // If empty, check branch name and auto-seed if it matches Aurahi
        if (!results || results.length === 0) {
          const br = await db.prepare('SELECT id, name FROM branches WHERE id = ?').bind(bId).first().catch(() => null);
          const brName = (br?.name || '').toLowerCase();
          if (brName.includes('aurahi') || brName.includes('aaurahi')) {
            const aurahiDefaults = ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar'];
            for (const name of aurahiDefaults) {
              await db.prepare(\`
                INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
              \`).bind(companyId, bId, name).run().catch(() => {});
            }
            const recheck = await db.prepare(
              'SELECT * FROM landmarks WHERE company_id = ? AND branch_id = ? ORDER BY id ASC'
            ).bind(companyId, bId).all();
            results = recheck.results || [];
          }
        }

        const coverageNames = (results || []).map((l) => l.name);
        return jsonResponse({
          success: true,
          branch_id: bId,
          coverage_areas: coverageNames,
          landmarks: results || [],
        });
      }

      // GET: Read landmarks
      if (method === 'GET') {
        let query = 'SELECT * FROM landmarks WHERE company_id = ?';
        const params = [companyId];
        if (branchIdParam) {
          query += ' AND branch_id = ?';
          params.push(Number(branchIdParam));
        }
        query += ' ORDER BY branch_id ASC, id ASC';

        const { results } = await db.prepare(query).bind(...params).all();

        return jsonResponse({
          success: true,
          landmarks: results || [],
          count: (results || []).length,
        });
      }

      // POST: Create new landmark
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const branchId = Number(body.branch_id || branchIdParam || 0);
        const name = (body.name || '').trim();

        if (!branchId) {
          return jsonResponse({ error: 'Branch is required' }, 400);
        }
        if (!name) {
          return jsonResponse({ error: 'Landmark name is required' }, 400);
        }

        const res = await db.prepare(\`
          INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        \`).bind(cid, branchId, name).run();

        const insertedId = res.meta.last_row_id;
        const inserted = await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(insertedId).first();

        return jsonResponse({
          success: true,
          id: insertedId,
          landmark: inserted || { id: insertedId, company_id: cid, branch_id: branchId, name },
          message: 'Landmark created successfully in D1 database table landmarks',
        });
      }

      // PUT: Update landmark
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json();
        const landmarkId = paramId || Number(body.id);
        if (!landmarkId) {
          return jsonResponse({ error: 'Landmark ID is required' }, 400);
        }

        const current = (await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(landmarkId).first()) || {};
        const branchId = body.branch_id !== undefined ? Number(body.branch_id) : current.branch_id;
        const name = body.name !== undefined ? (body.name || '').trim() : current.name;

        await db.prepare(\`
          UPDATE landmarks
          SET branch_id = ?, name = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        \`).bind(branchId, name, landmarkId, companyId).run();

        const updated = await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(landmarkId).first();

        return jsonResponse({
          success: true,
          id: landmarkId,
          landmark: updated,
          message: 'Landmark updated successfully in D1 database table landmarks',
        });
      }

      // DELETE: Delete landmark
      if (method === 'DELETE') {
        const landmarkId = paramId || Number(url.searchParams.get('id'));
        if (!landmarkId) {
          return jsonResponse({ error: 'Landmark ID is required' }, 400);
        }

        await db.prepare('DELETE FROM landmarks WHERE id = ? AND company_id = ?').bind(landmarkId, companyId).run();

        return jsonResponse({
          success: true,
          id: landmarkId,
          message: 'Landmark deleted successfully from D1 database table landmarks',
        });
      }
    }

    // 6. Branches endpoint: read and write on D1 table 'branches'`;

code = code.replace(target3, landmarksEndpoint);

fs.writeFileSync('functions/api/[[route]].js', code, 'utf8');
console.log('Successfully updated functions/api/[[route]].js');

