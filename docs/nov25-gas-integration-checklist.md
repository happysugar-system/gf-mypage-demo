# November 25 rollout checklist

Review branch only. Do not deploy to production until approved.

## GAS files
- `integrations/gas/GF_ApplicationDetailSync.gs` — blob `1eb96c2f7965a6048a0fffef242842df7b62c64b`
- `integrations/gas/GF_DriverNoticeAdmin.gs` — blob `50bbf5eda326aa7583e167a97c4f15bae8dabb84`
- `integrations/gas/GF_DriverNoticeAdmin.html` — blob `ec582dbbf01784ee43c29b69fc4310656d0945ac`
- `integrations/gas/GF_MonthlyDeliveryPlan.gs` — blob `4fdc55539512e75268fb021642ba15cfeb29adb4`
- `integrations/gas/GF_MonthlyDeliveryHistory.gs` — blob `d99a5c963e838b51c5edb6d15bde7718b01ff5dd`
- `integrations/gas/GF_MonthlyDeliveryReport.gs` — blob `36f84d43cbaf33da6aef0826602e7525c459af21`
- `integrations/gas/GF_MonthlyDeliveryStaff.gs` — blob `5ececdaeba4e65d85888656e601d4451aa4ccf4e`
- `integrations/gas/GF_MonthlyDeliveryStaff.html` — blob `2d017abca008468882d23f019162b85195bebb94`
- `integrations/gas/GF_StaffExtraRoutes.gs` — blob `9ab717a431ffa96a7ee3982d36c575735cb8667b`

## Order
1. Back up live GAS and record deployment version and triggers.
2. Verify current staff authentication and route entrypoint; do not replace doGet or introduce a second login. Existing adapter is not yet wired.
3. Add files to a separate test GAS project. Configure test-only source/report IDs and server-side credentials. Do not enable production writes.
4. Test notice list/save and delivery report with authorized and unauthorized users. Confirm actual delivery definition (completed loan start is provisional).
5. Verify application schema and existing GF_SB helpers; run preview, then approved sync and reread. New receipt scheduled integration remains pending.
6. Publish separate review page and test LINE identity and display. Existing production API remains unchanged.
7. Obtain production approval before applying schema or changing deployments. Roll back by restoring prior deployment and disabling new sync flags.

Document resubmission excluded pending clarification. No live GAS deployment or trigger changes performed.
