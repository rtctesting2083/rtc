# Real Time Courier (RTC) — System Login Credentials Directory

This document lists all active credentials and user accounts for **Real Time Courier (RTC)**.

All users sign in through the **Unified Login Page**:
- **Live Cloudflare Deployment**: [https://rtccourrier.pages.dev/login](https://rtccourrier.pages.dev/login)
- **Local Dev Server**: `http://localhost:3000/login`

> **Note on Unified Login**: Enter your account username, phone number, or company code into the Username field and your password. The system automatically detects your role and directs you straight to your dedicated portal.

---

## Real Time Courier (R.T.C Courier Pvt. Ltd.)

Primary headquarters, regional hubs/branches, riders, and registered merchants.

### A. Company Level (Headquarters)
| Name / Title | Account Identifier | Password | Role / Permissions | Portal URL |
| :--- | :--- | :--- | :--- | :--- |
| **Company Owner (RTC Admin)** | `rtc` | `rtc123` | Full Company Admin / Owner | `/company/overview` |
| **Sita Sharma** | `sita.sharma` | `sita123` | Operations Dispatcher & Shipments Manager | `/company/overview` |

### B. Branch Level (Butwal Head Office)
| Name / Title | Account Identifier | Password | Role / Permissions | Portal URL |
| :--- | :--- | :--- | :--- | :--- |
| **Branch Head (Hub Manager)** | `9800011111` *(or `butwal@rtccourier.com.np`)* | `butwal123` | Branch Head / Hub Manager | `/branch/overview` |
| **Bikash Thapa** | `bikash.thapa` | `bikash123` | Branch Staff / Shipments & Receiving | `/branch/overview` |

### C. Delivery Couriers (Riders)
| Rider Name | Vehicle | Mobile No. (Identifier) | Password | Portal URL |
| :--- | :--- | :--- | :--- | :--- |
| **Ramesh Thapa** (ID: 01) | Motorbike | `9811111111` | `ramesh123` | `/rider/deliveries` |
| **Sunita Gurung** (ID: 02) | Scooter | `9822222222` | `sunita123` | `/rider/deliveries` |

### D. Vendors / Business Clients (E-commerce Merchants)
| Business Name | Contact Person | Account Identifier | Password | Role | Portal URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Himalayan Traders** (ID: 01) | Sujan Rai | `9800000001` *(or `contact@himalayantraders.com.np`)* | `himalayan123` | Vendor Owner | `/customer/dashboard` |
| **Anil Gupta** | Anil Gupta | `anil.gupta` | `anil123` | Vendor Staff (Order Assistant) | `/customer/dashboard` |
| **Green Valley Store** (ID: 02) | Store Manager | `9800000002` | `greenvalley123` | Vendor Owner | `/customer/dashboard` |

---

## Quick Reference Summary Table

| Category | Typical Identifier Format | Example Identifier | Example Password | Direct Landing Page |
| :--- | :--- | :--- | :--- | :--- |
| **Company Owner** | Company code | `rtc` | `rtc123` | `/company/overview` |
| **Company Staff** | `firstname.lastname` | `sita.sharma` | `sita123` | `/company/overview` |
| **Branch Head** | 10-digit phone | `9800011111` | `butwal123` | `/branch/overview` |
| **Branch Staff** | `firstname.lastname` | `bikash.thapa` | `bikash123` | `/branch/overview` |
| **Vendor Owner** | 10-digit phone | `9800000001` | `himalayan123` | `/customer/dashboard` |
| **Vendor Staff** | `firstname.lastname` | `anil.gupta` | `anil123` | `/customer/dashboard` |
| **Rider / Courier** | 10-digit phone | `9811111111` | `ramesh123` | `/rider/deliveries` |

---

## How Authentication Resolution Works
1. **Identifier Check**: Enter your username, mobile phone, email, or company code `rtc` into the "Username" box.
2. **Password**: Enter the password corresponding to your account.
3. **Instant Routing**: The system checks permissions and instantly routes you to the matching portal.
