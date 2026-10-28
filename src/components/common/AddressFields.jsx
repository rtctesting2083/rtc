import React, { useState, useEffect } from 'react';
import { NEPAL_PROVINCES } from '../../utils/constants';

export function AddressFields({ value = {}, onChange }) {
  const [address, setAddress] = useState({
    province: value.province || '',
    district: value.district || '',
    municipality: value.municipality || '',
    ward: value.ward || '',
    tole: value.tole || '',
  });

  useEffect(() => {
    setAddress({
      province: value.province || '',
      district: value.district || '',
      municipality: value.municipality || '',
      ward: value.ward || '',
      tole: value.tole || '',
    });
  }, [value.province, value.district, value.municipality, value.ward, value.tole]);

  const handleProvinceChange = (e) => {
    const prov = e.target.value;
    const updated = { ...address, province: prov, district: '' };
    setAddress(updated);
    onChange(updated);
  };

  const handleChange = (field, val) => {
    const updated = { ...address, [field]: val };
    setAddress(updated);
    onChange(updated);
  };

  const districts = address.province ? NEPAL_PROVINCES[address.province] || [] : [];

  return (
    <div className="address-fields-group">
      <div className="form-row">
        <label>
          Province
          <select value={address.province} onChange={handleProvinceChange}>
            <option value="">Select province</option>
            {Object.keys(NEPAL_PROVINCES).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          District
          <select
            value={address.district}
            onChange={(e) => handleChange('district', e.target.value)}
            disabled={!address.province}
          >
            <option value="">Select district</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Municipality / Rural Municipality
          <input
            value={address.municipality}
            onChange={(e) => handleChange('municipality', e.target.value)}
            placeholder="e.g. Butwal Sub-Metropolitan City"
          />
        </label>
        <label>
          Ward No.
          <input
            type="number"
            min="1"
            value={address.ward}
            onChange={(e) => handleChange('ward', e.target.value)}
            placeholder="e.g. 5"
          />
        </label>
      </div>
      <label>
        Tole / Street
        <input
          value={address.tole}
          onChange={(e) => handleChange('tole', e.target.value)}
          placeholder="e.g. Milanchowk"
        />
      </label>
    </div>
  );
}
