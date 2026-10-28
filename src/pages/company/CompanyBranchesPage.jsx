import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { BranchFormModal } from '../../components/company/BranchFormModal';
import { addressSummary } from '../../utils/helpers';

export function CompanyBranchesPage() {
  const { branches, updateBranch } = useCompany();
  const { viewBranchAsAdmin } = useAuth();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const handleOpenAdd = () => {
    openModal('Add Branch', <BranchFormModal />);
  };

  const handleOpenEdit = (branch) => {
    openModal(`Edit Branch — ${branch.name}`, <BranchFormModal initialBranch={branch} />);
  };

  const handleViewAsAdmin = (branchId) => {
    viewBranchAsAdmin(branchId);
    navigate('/branch/overview');
  };

  const handleResetPw = (branch) => {
    openModal(
      `Reset Password — ${branch.name}`,
      <ResetBranchPwModal branch={branch} onReset={updateBranch} onClose={closeModal} />
    );
  };

  return (
    <div>
      <div className="view-head">
        <h1>Branches</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add branch
        </button>
      </div>

      <div className="banner">
        Branches represent hub offices and local distribution centers. You can switch into any branch's perspective
        with "View as branch" without needing their password.
      </div>

      <table>
        <thead>
          <tr>
            <th>Branch Name</th>
            <th>Login Phone</th>
            <th>Manager / Contact</th>
            <th>Address</th>
            <th>Staff Users</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id}>
              <td><b>{b.name}</b></td>
              <td>{b.phone}</td>
              <td>{b.contact_person || '—'}</td>
              <td>{addressSummary(b.address)}</td>
              <td>{b.staffUsers?.length || 0}</td>
              <td>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '12px' }}
                    onClick={() => handleViewAsAdmin(b.id)}
                  >
                    View as branch ➔
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleOpenEdit(b)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleResetPw(b)}
                  >
                    Reset PW
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {branches.length === 0 && (
            <tr>
              <td colSpan="6" className="table-empty">
                No branches registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResetBranchPwModal({ branch, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(branch.id, { password });
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
      <div className="row-actions" style={{ marginTop: '12px' }}>
        <button type="submit" className="btn-primary">
          Save Password
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
