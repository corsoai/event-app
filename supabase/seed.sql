insert into public.estates (
  id,
  name,
  address,
  contact_email,
  contact_phone,
  gate_name,
  payment_account_name,
  payment_bank_name,
  payment_account_number,
  service_charge_categories
) values
('11111111-1111-1111-1111-111111111111', 'LBS View Estate', 'LBS View Estate, Lagos', 'admin@lbsviewestate.example', '+234 801 111 2040', 'Main Gate A', 'Corso Estate Collections', 'GTBank', '0123456789', array['Service charge', 'Security levy', 'Waste management', 'Power/infrastructure levy', 'Maintenance fee']),
('22222222-2222-2222-2222-222222222222', 'Victoria Island Court', 'Akin Adesola Street, Victoria Island, Lagos', 'office@vicourt.example', '+234 802 300 4400', 'Ocean Gate', 'VI Court Collections', 'Zenith Bank', '0223344556', array['Service charge', 'Security levy', 'Power levy']),
('33333333-3333-3333-3333-333333333333', 'Abuja Royal Estate', 'Gwarinpa, Abuja', 'manager@abujaroyal.example', '+234 803 540 7100', 'Royal Gate', 'Abuja Royal Estate', 'Access Bank', '0987654321', array['Service charge', 'Waste management', 'Repairs']),
('44444444-4444-4444-4444-444444444444', 'Banana Island Residence', 'Banana Island, Ikoyi, Lagos', 'security@bananaresidence.example', '+234 809 440 0011', 'Lagoon Gate', 'Banana Residence Service', 'UBA', '0112233445', array['Service charge', 'Security levy', 'Infrastructure levy'])
on conflict (id) do nothing;

insert into public.profiles (id, estate_id, full_name, email, phone, role) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'Corso Platform Admin', 'super@corso.test', '+234 800 000 0001', 'super_admin'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'LBS View Estate Manager', 'admin@lbsview.test', '+234 801 111 2040', 'estate_admin'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Amina Okafor', 'resident@lbsview.test', '+234 803 920 4412', 'resident'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Gate Officer Musa', 'security@lbsview.test', '+234 806 000 1122', 'security_guard')
on conflict (id) do nothing;

insert into public.residents (id, estate_id, profile_id, full_name, apartment_number, phone, email, resident_type, status) values
('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Amina Okafor', 'B12', '+234 803 920 4412', 'amina.okafor@example.com', 'owner', 'active'),
('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, 'Tunde Balogun', 'C04', '+234 805 110 9320', 'tunde.balogun@example.com', 'tenant', 'active'),
('10000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', null, 'Ngozi Hassan', 'Penthouse 2', '+234 809 440 2281', 'ngozi.hassan@example.com', 'owner', 'active'),
('10000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', null, 'Chinedu Eze', 'R18', '+234 812 617 0031', 'chinedu.eze@example.com', 'tenant', 'inactive')
on conflict (id) do nothing;

insert into public.household_members (estate_id, resident_id, full_name, relationship, phone) values
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Daniel Okafor', 'Spouse', '+234 801 220 1021'),
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Sade Okafor', 'Child', '+234 809 481 2012');

insert into public.domestic_staff (estate_id, resident_id, full_name, phone, job_type, digital_id_number) values
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Grace Monday', '+234 803 001 9912', 'Domestic worker', 'SSE-STAFF-204');

insert into public.vehicles (estate_id, resident_id, plate_number, make, model, color) values
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'LND-482-KJ', 'Toyota', 'Prado', 'Black'),
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'EKY-721-GT', 'Honda', 'Accord', 'Silver'),
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'ABC-992-LA', 'Lexus', 'RX350', 'White')
on conflict (estate_id, plate_number) do nothing;

insert into public.visitors (
  id,
  estate_id,
  resident_id,
  visitor_name,
  phone,
  visit_date,
  expected_arrival_time,
  purpose,
  visitor_count,
  vehicle_plate_number,
  access_code,
  qr_payload,
  expires_at,
  status,
  created_by
) values
('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Cane Corso', '+234 906 343 1313', '2026-05-15', '14:30', 'Family visit', 2, 'APP-443-LG', '482913', '482913', '2026-05-15 23:59:00+01', 'pending', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'Kemi Adeyemi', '+234 802 012 7190', '2026-05-15', '10:00', 'Maintenance inspection', 1, null, '739204', '739204', '2026-05-15 23:59:00+01', 'checked_in', null),
('20000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000003', 'Dispatch Rider', '+234 701 220 1199', '2026-05-15', '16:00', 'Delivery', 1, 'BDG-210-QP', '158620', '158620', '2026-05-15 23:59:00+01', 'verified', null)
on conflict (id) do nothing;

insert into public.visitor_logs (estate_id, visitor_id, security_guard_id, gate_name, entry_time, decision, notes) values
('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Main Gate A', '2026-05-15 10:12:00+01', 'checked_in', 'Vehicle not provided');

insert into public.digital_ids (estate_id, profile_id, resident_id, id_number, holder_name, holder_type, qr_payload, status) values
('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-000000000001', 'SSE-RES-001', 'Amina Okafor', 'Resident owner', 'SSE-RES-001', 'active'),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'SSE-SEC-001', 'Gate Officer Musa', 'Security guard', 'SSE-SEC-001', 'active')
on conflict (id_number) do nothing;

insert into public.bills (id, estate_id, resident_id, title, category, amount, due_date, status, created_by) values
('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'May 2026 Service Charge', 'Service charge', 85000, '2026-05-28', 'unpaid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'Security Levy', 'Security levy', 30000, '2026-05-20', 'partially_paid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('30000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000003', 'Power Infrastructure Levy', 'Power/infrastructure levy', 140000, '2026-05-30', 'paid', null),
('30000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000004', 'Waste Management', 'Waste management', 18000, '2026-05-05', 'overdue', null)
on conflict (id) do nothing;

insert into public.payments (estate_id, bill_id, resident_id, amount, payment_reference, status, confirmed_by, paid_at, confirmed_at) values
('22222222-2222-2222-2222-222222222222', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 140000, 'GTB-TRF-54012', 'confirmed', null, '2026-05-09 12:00:00+01', '2026-05-09 14:10:00+01'),
('11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 15000, 'OPAY-192001', 'pending', null, '2026-05-12 15:04:00+01', null);

insert into public.complaints (estate_id, resident_id, category, title, description, priority, status, assigned_to, sla_due_at) values
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'power', 'Transformer noise at night', 'Transformer beside B block makes loud noise after 10 PM.', 'medium', 'in_progress', 'Facility desk', '2026-05-18 09:00:00+01'),
('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'security', 'Unknown vehicle parked near C block', 'A white vehicle has been parked near C block since morning.', 'high', 'open', 'Main Gate A', '2026-05-16 09:00:00+01'),
('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000003', 'waste', 'Waste pickup skipped', 'Waste truck did not collect on the last scheduled day.', 'low', 'resolved', 'Waste contractor', null);

insert into public.emergency_alerts (
  id,
  estate_id,
  resident_id,
  created_by,
  alert_type,
  status,
  resident_name,
  house_number,
  phone,
  location_label,
  notes,
  siren_requested,
  acknowledged_by,
  acknowledged_at,
  created_at
) values
('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', null, 'suspicious_movement', 'acknowledged', 'Tunde Balogun', 'C04', '+234 805 110 9320', 'C04, LBS View Estate, Lagos', 'Resident reported movement around C Block parking after midnight.', false, 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-05-15 22:20:00+01', '2026-05-15 22:18:00+01')
on conflict (id) do nothing;

insert into public.announcements (estate_id, title, message, target_audience, priority, publish_date, created_by) values
('11111111-1111-1111-1111-111111111111', 'Power maintenance window', 'Estate transformer servicing is scheduled from 10:00 AM to 1:00 PM on Saturday.', 'all_residents', 'urgent', '2026-05-15', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'May dues reminder', 'Please upload payment proof after transfer to the estate account.', 'owners', 'normal', '2026-05-14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('22222222-2222-2222-2222-222222222222', 'New visitor verification process', 'Security will now verify visitor access codes before allowing entry.', 'security', 'normal', '2026-05-11', null);

insert into public.knowledge_base (estate_id, title, category, body, created_by) values
('11111111-1111-1111-1111-111111111111', 'Estate Rules', 'Community', 'Quiet hours, facility usage, short-let policy, parking rules, and conduct guidelines.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'Waste Disposal Guide', 'Facilities', 'Collection days, bin locations, recycling notes, and bulk waste pickup process.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'Security Rules', 'Access Control', 'Visitor invitation rules, vehicle checks, contractor entry, and emergency escalation.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'Payment Instructions', 'Billing', 'Estate bank account details, payment reference format, and proof upload process.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'Emergency Contacts', 'Safety', 'Security control room, estate manager, ambulance, fire service, and police contacts.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into public.activity_logs (estate_id, actor_profile_id, action, entity_type, metadata) values
('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'created visitor invitation', 'visitor', '{"code":"482913"}'),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'checked in visitor', 'visitor', '{"code":"739204","gate":"Main Gate A"}'),
('11111111-1111-1111-1111-111111111111', null, 'uploaded payment proof', 'payment', '{"reference":"OPAY-192001"}'),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'published announcement', 'announcement', '{"title":"Power maintenance window"}');

