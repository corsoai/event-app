# LBS View Resident Onboarding

This import path keeps private resident data out of the public repository.

## Identity Rules

- LBS View normal property/unit: `LDI-01-A`
- Jeds Court Apartments: `JC-1`, `JC-2`, `JC-10`
- Ateeq Apartment: `AA-1` through `AA-8`

Legacy values remain searchable as notes:

- Jeds examples: `JC1`, `JC11`, `JC22 Jed's Court Apartments`
- Ateeq examples: `A1, Ateeq Apartments`, `A8, Ateeq Apartments`
- Old landlord/property labels: saved as legacy property/resident notes, not as official IDs

## Excel Handling

The exported Excel mixes several values into broad columns:

- Full name, alias, phone, and email are in one cell.
- Apartment type, legacy unit/address, and old property/landlord label are in one cell.
- Payment columns are usable for opening balance and monthly charge.

Use the private preview script:

```powershell
.\scripts\lbsview-resident-import-preview.ps1 -WorkbookPath "C:\Users\MICROSOFT PC\Desktop\AI BUILDER\LBSView Resident Data.xlsx"
```

It writes private files to `.local-import/`, which is gitignored:

- `lbsview-onboarding-preview.json`
- `lbsview-onboarding-summary.json`

## Import Policy

Import automatically when:

- resident role is `RESIDENT` or `EX RESIDENT`
- a clean unit ID is detected
- property group is `JC`, `AA`, or an approved LDI group

Flag for manual review when:

- no unit ID is present
- the row is not a resident role
- phone and email are both missing
- the old address/landlord label cannot be mapped safely

## App Onboarding

Admin can now manually:

- create property groups such as `JC` and `AA`
- create units and normalize IDs like `JC1` to `JC-1`
- attach a resident to a unit
- preserve legacy name/address notes
- mark old occupants as `moved out`
- create an opening balance bill during onboarding
