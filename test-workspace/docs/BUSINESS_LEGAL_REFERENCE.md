# Business Legal Reference

**Document Purpose**: Consolidated legal and business information for Veritable Games
**Created**: November 20, 2025
**Sources**: Company filing directory (`~/Documents/Company/`)

---

## Business Entity Information

### Legal Names
- **Official LLC Name**: Veritable Games Corp.
- **DBA/Fictitious Name**: Veritable Games
- **Trade Name for Payment Processing**: Veritable Games (use this for Stripe as sole proprietor)

### Owner Information
- **Owner**: Christopher William Corella
- **Primary Contact**: 941-928-2228

### Business Addresses

**Current Address (Nevada)**:
```
20 W College Pkwy
Carson City, Nevada 89706
```

**Original Address (Florida)**:
```
4904 Sabal Lake Circle
Sarasota, Florida 34238
```

---

## Tax Information

### Tax Classification
- **IRS Classification**: Individual/Sole Proprietor (per W-9 form dated 2/24/2020)
- **Tax ID Type**: SSN (Social Security Number)
- **Tax ID Number**: 385-17-2724
- **EIN Status**: ❌ No EIN obtained

### W-9 Form Details
- **File**: `~/Documents/Company/Filing/corporate files/Print W-9.pdf`
- **Date Filed**: February 24, 2020
- **Business Name**: Veritable Games
- **Checkbox Marked**: Individual/sole proprietor or single-member LLC
- **Federal Tax Classification**: Sole proprietor

---

## State Registrations

### Florida Fictitious Name Registration

**Registration Details**:
- **Entity Name**: VERITABLE GAMES
- **Registration Number**: G13000074521
- **Registration Date**: July 25, 2013
- **Status**: Active
- **State**: Florida
- **County**: Sarasota
- **City**: Sarasota

**Publication**:
- **Newspaper**: Herald-Tribune (Sarasota)
- **Publication Date**: August 13, 2013
- **Order Number**: SC50G0MQ2I

**Source Documents**:
- `~/Documents/Company/Filing/corporate files/COS-G13000074521.pdf` (Certificate of Status)
- `~/Documents/Company/Filing/corporate files/Fictitious name form-signed.pdf`
- `~/Documents/Company/Filing/corporate files/SC50G0MQ2I-1.PDF` (Publication notice)

---

## IRS Documents Inventory

### Documents Currently on File
✅ **W-9 Form** (`Print W-9.pdf`)
- Completed and signed
- Date: 2/24/2020
- Shows SSN as Tax ID

### Documents NOT on File
The following IRS documents were searched for but NOT found:

❌ **IRS Letter 147C** - EIN assignment letter
❌ **IRS SS-4 Confirmation Letter** - EIN application confirmation
❌ **IRS Fax Transmission Letter** - Fax EIN assignment
❌ **EIN Assistance Letter** - EIN help desk correspondence

**Conclusion**: Business is operating under SSN, not EIN. This is normal and acceptable for sole proprietors.

---

## How to Request an EIN (If Needed)

### When You Might Need an EIN
- Hiring employees
- Opening business bank accounts requiring EIN
- Establishing business credit separate from personal credit
- Privacy (to avoid using SSN on business documents)

### Current Status
✅ **You do NOT need an EIN for Stripe** - Using SSN as sole proprietor is acceptable and already configured

### If You Decide to Get an EIN

#### Option 1: Online Application (Recommended - Instant)
1. Visit: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
2. Complete Form SS-4 online
3. Receive EIN immediately upon completion (instant)

**Information to Provide**:
- Legal business name: Veritable Games Corp.
- Trade name/DBA: Veritable Games
- Responsible party: Christopher William Corella
- Responsible party SSN: 385-17-2724
- Business address: 20 W College Pkwy, Carson City, NV 89706
- Business type: Sole proprietorship
- Reason for applying: Banking purposes (or "Started new business")

#### Option 2: Fax Application (4 Business Days)
1. Download Form SS-4: https://www.irs.gov/pub/irs-pdf/fss4.pdf
2. Complete the form using information above
3. Fax to: (855) 641-6935
4. Receive EIN confirmation via fax in 4 business days
5. IRS will mail Letter 147C (EIN assignment letter) for your records

#### Option 3: Mail Application (4+ Weeks)
1. Download Form SS-4
2. Complete the form
3. Mail to:
   ```
   Internal Revenue Service
   Attn: EIN Operation
   Cincinnati, OH 45999
   ```
4. Wait 4+ weeks for EIN letter by mail

---

## Payment Processing Configuration

### Stripe Account

**Account Status**: Test Mode (waiting for approval)

**Test API Keys** (Configured in `frontend/.env.local`):
- **Publishable Key**: `pk_test_51SVgY8JzFK5vZTKEUsX4vogmY0Jehi4vtMDbheSUmsQLs1hZl5nFekZyZQxfnboQKuGPejE7n7MYzfDDaS7swItW00AygZPvzH`
- **Secret Key**: `sk_test_51SVgY8JzFK5vZTKEjdoL5eUeZQgZnS8udgpzZEID1HJF0fAqFqHthXZblbbHFe5z1HPRaTSwCpgvgUpQSMrTJzng002ZCAkmSw`
- **Webhook Secret**: Not yet configured (obtain from Stripe Dashboard)

**Business Name for Stripe**: "Veritable Games" (as Individual/Sole Proprietor)

**Tax ID for Stripe**: SSN 385-17-2724 (acceptable for sole proprietors)

### BTCPay Server

**Configuration**: Placeholder values in `.env.local` (to be configured)

---

## Legal Documents Location

All legal documents stored in: `~/Documents/Company/`

### Directory Structure
```
~/Documents/Company/
├── LLC                              # Contains "Veritable Games Corp."
├── Filing/
│   ├── corporate files/
│   │   ├── Print W-9.pdf           # Tax form (SSN)
│   │   ├── COS-G13000074521.pdf    # FL Certificate of Status
│   │   ├── Fictitious name form-signed.pdf
│   │   ├── SC50G0MQ2I-1.PDF        # Publication notice
│   │   └── [Various receipts]      # Payment receipts for filings
│   └── regardingcopyright.pdf      # Copyright registration info
├── Logo/                            # Brand assets
└── Contracts/                       # Business contracts
```

---

## Important Notes

### For Stripe Integration
✅ **Use SSN, not EIN** - You're configured correctly as sole proprietor
✅ **Business name**: "Veritable Games" (not "Veritable Games Corp.")
✅ **Business address**: 20 W College Pkwy, Carson City, NV 89706
✅ **Tax classification**: Individual/Sole Proprietor

### For Future Reference
- Keep W-9 form accessible for payment processors
- Update address if you move (affects tax filings)
- If you get EIN in future, add Letter 147C to filing directory
- Florida registration is still active (renewed periodically)

---

## Contact Information for Updates

### IRS
- **Phone**: 1-800-829-4933 (Business & Specialty Tax Line)
- **Hours**: Monday-Friday 7am-7pm local time
- **Online**: https://www.irs.gov/businesses

### Florida Division of Corporations
- **Phone**: 850-245-6052
- **Online**: https://dos.myflorida.com/sunbiz/
- **Search by Registration #**: G13000074521

### Nevada Secretary of State (If registering in NV)
- **Phone**: 775-684-5708
- **Online**: https://www.nvsos.gov/sos

---

**Document Status**: ✅ Complete and up-to-date as of November 20, 2025
