
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  full_name text,
  role text default 'employee',
  created_at timestamp default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  customer_name text,
  location_type text default 'hanoi',
  status text default 'active',
  created_at timestamp default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  salary_type text default 'day',
  day_rate numeric default 0,
  fixed_salary numeric default 0,
  bhxh numeric default 0,
  tnc_type text default '10_percent',
  created_at timestamp default now()
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  project_id uuid references projects(id),
  work_date date,
  shift_type text default 'day',
  work_day numeric default 1,
  normal_ot_hours numeric default 0,
  sunday_ot_hours numeric default 0,
  allowance numeric default 0,
  advance_amount numeric default 0,
  image_note text,
  note text,
  approve_status text default 'pending',
  created_at timestamp default now()
);

create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  payroll_month text,
  total_work_day numeric default 0,
  total_salary numeric default 0,
  total_allowance numeric default 0,
  total_ot numeric default 0,
  total_advance numeric default 0,
  total_bhxh numeric default 0,
  total_tncn numeric default 0,
  net_salary numeric default 0,
  created_at timestamp default now()
);

alter table users enable row level security;
alter table employees enable row level security;
alter table projects enable row level security;
alter table timesheets enable row level security;
alter table payroll enable row level security;

-- Prototype policies: allow anon read/write.
-- Khi làm bản chính thức có đăng nhập OTP, cần siết lại theo user_id/role.
drop policy if exists "prototype_all_users" on users;
drop policy if exists "prototype_all_employees" on employees;
drop policy if exists "prototype_all_projects" on projects;
drop policy if exists "prototype_all_timesheets" on timesheets;
drop policy if exists "prototype_all_payroll" on payroll;

create policy "prototype_all_users" on users for all using (true) with check (true);
create policy "prototype_all_employees" on employees for all using (true) with check (true);
create policy "prototype_all_projects" on projects for all using (true) with check (true);
create policy "prototype_all_timesheets" on timesheets for all using (true) with check (true);
create policy "prototype_all_payroll" on payroll for all using (true) with check (true);
