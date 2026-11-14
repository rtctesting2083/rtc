/**
 * BranchHierarchyService.js
 * Scalable recursive hierarchy service for R.T.C. Courier Pvt. Ltd.
 * Powered by Cloudflare D1 SQLite recursive CTEs.
 */

export class BranchHierarchyService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 1. Fetch a branch and all its recursive descendants as a flat list with depth.
   */
  async getDescendantBranches(rootBranchId) {
    const query = `
      WITH RECURSIVE branch_tree AS (
        SELECT 
          id, branch_code, name, name_np, parent_branch_id, tier, model_type,
          province_id, district_id, local_level_id, ward_number,
          contact_person, phone, status, 0 AS depth
        FROM branches
        WHERE id = ?

        UNION ALL

        SELECT 
          b.id, b.branch_code, b.name, b.name_np, b.parent_branch_id, b.tier, b.model_type,
          b.province_id, b.district_id, b.local_level_id, b.ward_number,
          b.contact_person, b.phone, b.status, bt.depth + 1
        FROM branches b
        INNER JOIN branch_tree bt ON b.parent_branch_id = bt.id
        WHERE b.status = 'active' OR b.status = 'ACTIVE'
      )
      SELECT * FROM branch_tree ORDER BY depth ASC, id ASC;
    `;

    const { results } = await this.db.prepare(query).bind(Number(rootBranchId)).all();
    return results || [];
  }

  /**
   * Check whether targetParentId is branchId itself or any of branchId's descendants (to prevent circular loops).
   */
  async isDescendantOrSelf(branchId, targetParentId) {
    if (!branchId || !targetParentId) return false;
    if (Number(branchId) === Number(targetParentId)) return true;

    const query = `
      WITH RECURSIVE descendant_tree AS (
        SELECT id FROM branches WHERE id = ?
        UNION ALL
        SELECT b.id
        FROM branches b
        INNER JOIN descendant_tree dt ON b.parent_branch_id = dt.id
      )
      SELECT id FROM descendant_tree WHERE id = ?;
    `;
    const res = await this.db.prepare(query).bind(Number(branchId), Number(targetParentId)).first();
    return Boolean(res && res.id);
  }

  /**
   * Get array of all descendant IDs (including self) for a given branchId.
   */
  async getBranchDescendantIds(branchId) {
    if (!branchId) return [];
    const query = `
      WITH RECURSIVE descendant_tree AS (
        SELECT id FROM branches WHERE id = ?
        UNION ALL
        SELECT b.id
        FROM branches b
        INNER JOIN descendant_tree dt ON b.parent_branch_id = dt.id
      )
      SELECT id FROM descendant_tree;
    `;
    const { results } = await this.db.prepare(query).bind(Number(branchId)).all();
    return (results || []).map((r) => r.id);
  }

  /**
   * 2. Build a nested hierarchical tree structure (JSON) for UI views.
   */
  async getNestedBranchTree(rootBranchId) {
    const flatList = await this.getDescendantBranches(rootBranchId);
    if (!flatList || flatList.length === 0) return null;

    const map = new Map();
    flatList.forEach((node) => map.set(node.id, { ...node, children: [] }));

    let root = null;
    map.forEach((node) => {
      if (node.id === Number(rootBranchId)) {
        root = node;
      } else if (node.parent_branch_id && map.has(node.parent_branch_id)) {
        map.get(node.parent_branch_id).children.push(node);
      }
    });

    return root;
  }

  /**
   * 3. Fetch all active riders operating under a branch and all its descendants.
   */
  async getRidersUnderHierarchy(branchId) {
    const query = `
      WITH RECURSIVE branch_hierarchy AS (
        SELECT id FROM branches WHERE id = ?
        UNION ALL
        SELECT b.id 
        FROM branches b
        INNER JOIN branch_hierarchy bh ON b.parent_branch_id = bh.id
        WHERE b.status = 'active' OR b.status = 'ACTIVE'
      )
      SELECT 
        r.id, r.branch_id, b.name AS branch_name, b.branch_code, r.rider_code, r.name, r.phone,
        r.vehicle_type, r.compensation_type, r.base_salary, r.commission_rate,
        r.duty_status, r.status
      FROM riders r
      INNER JOIN branch_hierarchy bh ON r.branch_id = bh.id
      INNER JOIN branches b ON r.branch_id = b.id
      WHERE r.status = 'active' OR r.status = 'ACTIVE'
      ORDER BY b.id ASC, r.name ASC;
    `;

    const { results } = await this.db.prepare(query).bind(Number(branchId)).all();
    return results || [];
  }

  /**
   * 4. Fetch all active B2B vendors under a branch hierarchy.
   */
  async getVendorsUnderHierarchy(branchId) {
    const query = `
      WITH RECURSIVE branch_hierarchy AS (
        SELECT id FROM branches WHERE id = ?
        UNION ALL
        SELECT b.id 
        FROM branches b
        INNER JOIN branch_hierarchy bh ON b.parent_branch_id = bh.id
        WHERE b.status = 'active' OR b.status = 'ACTIVE'
      )
      SELECT 
        v.id, v.branch_id, b.name AS branch_name, b.branch_code, v.vendor_code, v.name AS business_name,
        v.contact_person, v.phone, v.pan_vat_number, v.bank_name,
        v.account_number AS bank_account_number, v.status
      FROM vendors v
      INNER JOIN branch_hierarchy bh ON v.branch_id = bh.id
      INNER JOIN branches b ON v.branch_id = b.id
      WHERE v.status = 'active' OR v.status = 'ACTIVE'
      ORDER BY b.id ASC, v.name ASC;
    `;

    const { results } = await this.db.prepare(query).bind(Number(branchId)).all();
    return results || [];
  }

  /**
   * 5. Fetch ancestor chain (Breadcrumbs: Ward -> Municipality -> District -> Province -> Central).
   */
  async getAncestorChain(branchId) {
    const query = `
      WITH RECURSIVE ancestor_tree AS (
        SELECT 
          id, branch_code, name, name_np, parent_branch_id, tier, model_type,
          province_id, district_id, local_level_id, ward_number,
          contact_person, phone, status, 0 AS level
        FROM branches
        WHERE id = ?

        UNION ALL

        SELECT 
          b.id, b.branch_code, b.name, b.name_np, b.parent_branch_id, b.tier, b.model_type,
          b.province_id, b.district_id, b.local_level_id, b.ward_number,
          b.contact_person, b.phone, b.status, at.level + 1
        FROM branches b
        INNER JOIN ancestor_tree at ON b.id = at.parent_branch_id
      )
      SELECT * FROM ancestor_tree ORDER BY level DESC;
    `;

    const { results } = await this.db.prepare(query).bind(Number(branchId)).all();
    return results || [];
  }

  /**
   * 6. Geo tables retrieval
   */
  async getGeoProvinces() {
    const { results } = await this.db.prepare('SELECT * FROM geo_provinces ORDER BY id ASC').all();
    return results || [];
  }

  async getGeoDistricts(provinceId = null) {
    let query = 'SELECT * FROM geo_districts';
    const params = [];
    if (provinceId) {
      query += ' WHERE province_id = ?';
      params.push(Number(provinceId));
    }
    query += ' ORDER BY name_en ASC';
    const stmt = params.length > 0 ? this.db.prepare(query).bind(...params) : this.db.prepare(query);
    const { results } = await stmt.all();
    return results || [];
  }

  async getGeoLocalLevels(districtId = null) {
    let query = 'SELECT * FROM geo_local_levels';
    const params = [];
    if (districtId) {
      query += ' WHERE district_id = ?';
      params.push(Number(districtId));
    }
    query += ' ORDER BY name_en ASC';
    const stmt = params.length > 0 ? this.db.prepare(query).bind(...params) : this.db.prepare(query);
    const { results } = await stmt.all();
    return results || [];
  }
}
