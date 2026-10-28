import React from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { useModal } from '../../context/ModalContext';
import { fmtDate, slugify } from '../../utils/helpers';
import { companyDataKey } from '../../utils/constants';

export function AdminCompaniesPage() {
  const { companies, addCompany, updateCompany, resetCompanyPassword, toggleCompanyStatus, deleteCompany } = usePlatform();
  const { openModal, closeModal } = useModal();

  const getCompanyShipmentCount = (id) => {
    try {
      const raw = localStorage.getItem(companyDataKey(id));
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return data?.shipments?.length || 0;
    } catch (e) {
      return 0;
    }
  };

  const handleOpenAddCompany = () => {
    openModal('Add Company', <AddCompanyModal onAdd={addCompany} onClose={closeModal} />);
  };

  const handleOpenEdit = (company) => {
    openModal(
      `Edit Company — ${company.name}`,
      <EditCompanyModal company={company} onUpdate={updateCompany} onClose={closeModal} />
    );
  };

  const handleOpenResetPw = (company) => {
    openModal(
      `Reset Password — ${company.name}`,
      <ResetPwModal company={company} onReset={resetCompanyPassword} onClose={closeModal} />
    );
  };

  const handleDelete = (company) => {
    if (
      window.confirm(
        `Delete ${company.name}? This removes the company and all of its shipment/vendor/rider/invoice data. This cannot be undone.`
      )
    ) {
      deleteCompany(company.id);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Courier Companies</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAddCompany}>
          + Add company
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Shipments</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td className="mono">{c.slug}</td>
              <td>
                <span className={`pill pill-${c.status}`}>{c.status}</span>
              </td>
              <td>{getCompanyShipmentCount(c.id)}</td>
              <td>{fmtDate(c.created_at)}</td>
              <td>
                <div className="row-actions">
                  <button type="button" className="btn-secondary" onClick={() => handleOpenEdit(c)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => handleOpenResetPw(c)}>
                    Reset PW
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => toggleCompanyStatus(c.id)}
                  >
                    {c.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="btn-danger-text"
                    onClick={() => handleDelete(c)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan="6" className="table-empty">
                No companies registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddCompanyModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!slugTouched) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    try {
      onAdd({ name: name.trim(), slug: slug.trim(), password });
      onClose();
    } catch (err) {
      setError(err.message || 'Error adding company.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Company Name *
        <input value={name} onChange={handleNameChange} required />
      </label>
      <label>
        Login Slug (unique URL identifier) *
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          required
        />
      </label>
      <label>
        Initial Password *
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
        Add Company
      </button>
    </form>
  );
}

function EditCompanyModal({ company, onUpdate, onClose }) {
  const [name, setName] = useState(company.name);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(company.id, { name: name.trim() });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Company Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
        Save
      </button>
    </form>
  );
}

function ResetPwModal({ company, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(company.id, password);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New Password *
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
        Set New Password
      </button>
    </form>
  );
}
