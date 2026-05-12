
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { CalendarDays, CheckCircle2, Download, FolderKanban, Plus, Users, Wallet } from 'lucide-react'
import * as XLSX from 'xlsx'

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function isSunday(dateText) {
  return new Date(`${dateText}T00:00:00`).getDay() === 0
}

function locationAllowance(type) {
  if (type === 'hanoi') return 100000
  if (type === 'province') return 50000
  return 0
}

function calcTimesheet(row, emp, project) {
  const dayRate = emp?.salary_type === 'fixed' ? 0 : Number(emp?.day_rate || 0)
  const hourlyRate = dayRate / 8
  const workPay = emp?.salary_type === 'fixed' ? 0 : dayRate * Number(row.work_day || 0)
  const normalOtPay = hourlyRate * Number(row.normal_ot_hours || 0) * 1.5
  const sundayOtPay = hourlyRate * Number(row.sunday_ot_hours || 0) * 2
  const allowance = Number(row.allowance || 0) || locationAllowance(project?.location_type) * Number(row.work_day || 0)
  return { workPay, normalOtPay, sundayOtPay, allowance, gross: workPay + normalOtPay + sundayOtPay + allowance }
}

export default function App() {
  const [tab, setTab] = useState('timesheet')
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [projects, setProjects] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [role, setRole] = useState('admin')
  const [currentEmployeeId, setCurrentEmployeeId] = useState('')

  const [employeeForm, setEmployeeForm] = useState({
    full_name: '', phone: '', salary_type: 'day', day_rate: '', fixed_salary: '', bhxh: '', tnc_type: '10_percent'
  })

  const [projectForm, setProjectForm] = useState({
    project_name: '', customer_name: '', location_type: 'hanoi', status: 'active'
  })

  const [timeForm, setTimeForm] = useState({
    employee_id: '', project_id: '', work_date: new Date().toISOString().slice(0, 10), shift_type: 'day',
    work_day: 1, normal_ot_hours: 0, sunday_ot_hours: 0, allowance: '', advance_amount: 0, image_note: '', note: ''
  })

  const canViewAll = role === 'admin' || role === 'manager'

  async function loadData() {
    setLoading(true)
    const [empRes, projectRes, timeRes] = await Promise.all([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('timesheets').select('*').order('work_date', { ascending: false })
    ])
    if (!empRes.error) setEmployees(empRes.data || [])
    if (!projectRes.error) setProjects(projectRes.data || [])
    if (!timeRes.error) setTimesheets(timeRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const visibleEmployees = useMemo(() => {
    if (canViewAll) return employees
    return employees.filter(e => e.id === currentEmployeeId)
  }, [employees, canViewAll, currentEmployeeId])

  const visibleTimesheets = useMemo(() => {
    return timesheets.filter(row => {
      const okMonth = String(row.work_date || '').startsWith(month)
      const okRole = canViewAll || row.employee_id === currentEmployeeId
      return okMonth && okRole
    })
  }, [timesheets, month, canViewAll, currentEmployeeId])

  const payroll = useMemo(() => {
    return visibleEmployees.map(emp => {
      const rows = visibleTimesheets.filter(r => r.employee_id === emp.id)
      const totalWorkDay = rows.reduce((s, r) => s + Number(r.work_day || 0), 0)
      const totalAdvance = rows.reduce((s, r) => s + Number(r.advance_amount || 0), 0)
      const totalNormalOt = rows.reduce((s, r) => s + Number(r.normal_ot_hours || 0), 0)
      const totalSundayOt = rows.reduce((s, r) => s + Number(r.sunday_ot_hours || 0), 0)
      const details = rows.map(r => calcTimesheet(r, emp, projects.find(p => p.id === r.project_id)))
      const workPay = emp.salary_type === 'fixed' ? Number(emp.fixed_salary || 0) : details.reduce((s, x) => s + x.workPay, 0)
      const otPay = details.reduce((s, x) => s + x.normalOtPay + x.sundayOtPay, 0)
      const allowance = details.reduce((s, x) => s + x.allowance, 0)
      const gross = workPay + otPay + allowance
      const bhxh = Number(emp.bhxh || 0)
      const tncn = emp.tnc_type === '10_percent' ? gross * 0.1 : 0
      const net = gross - bhxh - tncn - totalAdvance
      return { ...emp, totalWorkDay, totalNormalOt, totalSundayOt, workPay, otPay, allowance, gross, bhxh, tncn, totalAdvance, net }
    })
  }, [visibleEmployees, visibleTimesheets, projects])

  async function addEmployee() {
    if (!employeeForm.full_name) return alert('Nhập họ tên nhân viên')
    const { error } = await supabase.from('employees').insert({
      full_name: employeeForm.full_name,
      phone: employeeForm.phone,
      salary_type: employeeForm.salary_type,
      day_rate: Number(employeeForm.day_rate || 0),
      fixed_salary: Number(employeeForm.fixed_salary || 0),
      bhxh: Number(employeeForm.bhxh || 0),
      tnc_type: employeeForm.tnc_type
    })
    if (error) alert(error.message)
    setEmployeeForm({ full_name: '', phone: '', salary_type: 'day', day_rate: '', fixed_salary: '', bhxh: '', tnc_type: '10_percent' })
    loadData()
  }

  async function addProject() {
    if (!projectForm.project_name) return alert('Nhập tên công trình')
    const { error } = await supabase.from('projects').insert(projectForm)
    if (error) alert(error.message)
    setProjectForm({ project_name: '', customer_name: '', location_type: 'hanoi', status: 'active' })
    loadData()
  }

  async function addTimesheet() {
    const employee_id = canViewAll ? timeForm.employee_id : currentEmployeeId
    if (!employee_id) return alert('Chọn nhân viên')
    if (!timeForm.project_id) return alert('Chọn công trình')

    let normal = Number(timeForm.normal_ot_hours || 0)
    let sunday = Number(timeForm.sunday_ot_hours || 0)
    if (isSunday(timeForm.work_date) && normal > 0) {
      sunday += normal
      normal = 0
    }

    const { error } = await supabase.from('timesheets').insert({
      employee_id,
      project_id: timeForm.project_id,
      work_date: timeForm.work_date,
      shift_type: timeForm.shift_type,
      work_day: Number(timeForm.work_day || 0),
      normal_ot_hours: normal,
      sunday_ot_hours: sunday,
      allowance: Number(timeForm.allowance || 0),
      advance_amount: Number(timeForm.advance_amount || 0),
      image_note: timeForm.image_note,
      note: timeForm.note,
      approve_status: canViewAll ? 'approved' : 'pending'
    })
    if (error) alert(error.message)
    loadData()
  }

  async function approveAll() {
    const ids = visibleTimesheets.filter(r => r.approve_status === 'pending').map(r => r.id)
    if (ids.length === 0) return
    const { error } = await supabase.from('timesheets').update({ approve_status: 'approved' }).in('id', ids)
    if (error) alert(error.message)
    loadData()
  }

  function exportExcel() {
    const data = payroll.map(r => ({
      'Họ tên': r.full_name,
      'Công': r.totalWorkDay,
      'TC 150%': r.totalNormalOt,
      'TC CN 200%': r.totalSundayOt,
      'Lương + tăng ca': Math.round(r.workPay + r.otPay),
      'Phụ cấp': Math.round(r.allowance),
      'Tạm ứng': Math.round(r.totalAdvance),
      'TNCN': Math.round(r.tncn),
      'BHXH': Math.round(r.bhxh),
      'Thực lĩnh': Math.round(r.net)
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bang luong')
    XLSX.writeFile(wb, `bang-luong-${month}.xlsx`)
  }

  const totalNet = payroll.reduce((s, r) => s + r.net, 0)
  const totalPending = visibleTimesheets.filter(r => r.approve_status === 'pending').length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chấm công & tính lương Hải Anh</h1>
            <p className="text-sm text-slate-500">Quản lý nhân công, công trình, tăng ca, phụ cấp, tạm ứng, TNCN và BHXH.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="border rounded-lg px-3 py-2" value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">Quản trị</option>
              <option value="manager">Quản lý</option>
              <option value="employee">Nhân viên</option>
            </select>
            <select className="border rounded-lg px-3 py-2" value={currentEmployeeId} onChange={e => setCurrentEmployeeId(e.target.value)}>
              <option value="">Chọn nhân viên đang đăng nhập</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <input className="border rounded-lg px-3 py-2" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="grid md:grid-cols-4 gap-4">
          <Kpi icon={<Users />} label="Nhân viên" value={employees.length} />
          <Kpi icon={<FolderKanban />} label="Công trình" value={projects.length} />
          <Kpi icon={<CheckCircle2 />} label="Chờ duyệt" value={totalPending} />
          <Kpi icon={<Wallet />} label="Tổng thực lĩnh" value={money(totalNet)} />
        </div>

        <div className="bg-white rounded-2xl border p-2 flex flex-wrap gap-2">
          {[
            ['timesheet', 'Chấm công'],
            ['payroll', 'Bảng lương'],
            ['employees', 'Nhân viên'],
            ['projects', 'Công trình'],
            ['risk', 'Kiểm soát']
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl ${tab === key ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>{label}</button>
          ))}
        </div>

        {loading && <div className="bg-white rounded-xl border p-4">Đang tải dữ liệu...</div>}

        {tab === 'timesheet' && (
          <section className="bg-white rounded-2xl border p-4 space-y-4">
            <h2 className="text-xl font-semibold flex gap-2 items-center"><CalendarDays size={20}/> Chấm công hàng ngày</h2>
            <div className="grid md:grid-cols-4 lg:grid-cols-8 gap-2">
              {canViewAll && <select className="border rounded-lg px-3 py-2" value={timeForm.employee_id} onChange={e => setTimeForm({...timeForm, employee_id: e.target.value})}><option value="">Nhân viên</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>}
              <select className="border rounded-lg px-3 py-2" value={timeForm.project_id} onChange={e => setTimeForm({...timeForm, project_id: e.target.value})}><option value="">Công trình</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
              <input className="border rounded-lg px-3 py-2" type="date" value={timeForm.work_date} onChange={e => setTimeForm({...timeForm, work_date: e.target.value})}/>
              <select className="border rounded-lg px-3 py-2" value={timeForm.shift_type} onChange={e => setTimeForm({...timeForm, shift_type: e.target.value})}><option value="day">Ca ngày</option><option value="night">Ca đêm</option></select>
              <input className="border rounded-lg px-3 py-2" type="number" step="0.5" placeholder="Công" value={timeForm.work_day} onChange={e => setTimeForm({...timeForm, work_day: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="TC 150%" value={timeForm.normal_ot_hours} onChange={e => setTimeForm({...timeForm, normal_ot_hours: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="TC CN 200%" value={timeForm.sunday_ot_hours} onChange={e => setTimeForm({...timeForm, sunday_ot_hours: e.target.value})}/>
              <button onClick={addTimesheet} className="bg-slate-900 text-white rounded-lg px-3 py-2 flex items-center justify-center gap-2"><Plus size={16}/> Chấm công</button>
            </div>
            <div className="grid md:grid-cols-4 gap-2">
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="Phụ cấp nhập tay" value={timeForm.allowance} onChange={e => setTimeForm({...timeForm, allowance: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="Tạm ứng" value={timeForm.advance_amount} onChange={e => setTimeForm({...timeForm, advance_amount: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" placeholder="Ghi chú ảnh Zalo" value={timeForm.image_note} onChange={e => setTimeForm({...timeForm, image_note: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" placeholder="Ghi chú công việc" value={timeForm.note} onChange={e => setTimeForm({...timeForm, note: e.target.value})}/>
            </div>
            {canViewAll && <button onClick={approveAll} className="border rounded-lg px-4 py-2">Duyệt toàn bộ công đang chờ</button>}
            <Table headers={['Ngày','Nhân viên','Công trình','Ca','Công','TC150','TCCN','Tạm ứng','Trạng thái']}>
              {visibleTimesheets.map(r => {
                const emp = employees.find(e => e.id === r.employee_id)
                const p = projects.find(x => x.id === r.project_id)
                return <tr key={r.id} className="border-t">
                  <td className="p-2">{r.work_date}</td><td>{emp?.full_name}</td><td>{p?.project_name}</td><td>{r.shift_type === 'night' ? 'Đêm' : 'Ngày'}</td><td>{r.work_day}</td><td>{r.normal_ot_hours}</td><td>{r.sunday_ot_hours}</td><td>{money(r.advance_amount)}</td><td>{r.approve_status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}</td>
                </tr>
              })}
            </Table>
          </section>
        )}

        {tab === 'payroll' && (
          <section className="bg-white rounded-2xl border p-4 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-semibold">Bảng lương tháng {month}</h2>{canViewAll && <button onClick={exportExcel} className="bg-slate-900 text-white rounded-lg px-4 py-2 flex gap-2 items-center"><Download size={16}/> Xuất Excel</button>}</div>
            <Table headers={['Nhân viên','Công','TC150','TCCN','Lương+TC','Phụ cấp','Tạm ứng','TNCN','BHXH','Thực lĩnh']}>
              {payroll.map(r => <tr key={r.id} className="border-t"><td className="p-2 font-medium">{r.full_name}</td><td>{r.totalWorkDay}</td><td>{r.totalNormalOt}</td><td>{r.totalSundayOt}</td><td>{money(r.workPay + r.otPay)}</td><td>{money(r.allowance)}</td><td>{money(r.totalAdvance)}</td><td>{money(r.tncn)}</td><td>{money(r.bhxh)}</td><td className="font-bold">{money(r.net)}</td></tr>)}
            </Table>
          </section>
        )}

        {tab === 'employees' && (
          <section className="bg-white rounded-2xl border p-4 space-y-4">
            <h2 className="text-xl font-semibold">Nhân viên</h2>
            {role === 'admin' && <div className="grid md:grid-cols-4 lg:grid-cols-8 gap-2">
              <input className="border rounded-lg px-3 py-2" placeholder="Họ tên" value={employeeForm.full_name} onChange={e => setEmployeeForm({...employeeForm, full_name: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" placeholder="SĐT" value={employeeForm.phone} onChange={e => setEmployeeForm({...employeeForm, phone: e.target.value})}/>
              <select className="border rounded-lg px-3 py-2" value={employeeForm.salary_type} onChange={e => setEmployeeForm({...employeeForm, salary_type: e.target.value})}><option value="day">Lương ngày</option><option value="fixed">Lương cố định</option></select>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="Lương/ngày" value={employeeForm.day_rate} onChange={e => setEmployeeForm({...employeeForm, day_rate: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="Lương cố định" value={employeeForm.fixed_salary} onChange={e => setEmployeeForm({...employeeForm, fixed_salary: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" type="number" placeholder="BHXH" value={employeeForm.bhxh} onChange={e => setEmployeeForm({...employeeForm, bhxh: e.target.value})}/>
              <select className="border rounded-lg px-3 py-2" value={employeeForm.tnc_type} onChange={e => setEmployeeForm({...employeeForm, tnc_type: e.target.value})}><option value="10_percent">TNCN 10%</option><option value="progressive">Lũy tiến</option></select>
              <button onClick={addEmployee} className="bg-slate-900 text-white rounded-lg px-3 py-2">Thêm</button>
            </div>}
            <Table headers={['Họ tên','SĐT','Loại lương','Lương/ngày','Lương cố định','BHXH','TNCN']}>
              {visibleEmployees.map(e => <tr key={e.id} className="border-t"><td className="p-2 font-medium">{e.full_name}</td><td>{e.phone}</td><td>{e.salary_type === 'fixed' ? 'Cố định' : 'Ngày'}</td><td>{money(e.day_rate)}</td><td>{money(e.fixed_salary)}</td><td>{money(e.bhxh)}</td><td>{e.tnc_type}</td></tr>)}
            </Table>
          </section>
        )}

        {tab === 'projects' && (
          <section className="bg-white rounded-2xl border p-4 space-y-4">
            <h2 className="text-xl font-semibold">Công trình</h2>
            {canViewAll && <div className="grid md:grid-cols-5 gap-2">
              <input className="border rounded-lg px-3 py-2" placeholder="Tên công trình" value={projectForm.project_name} onChange={e => setProjectForm({...projectForm, project_name: e.target.value})}/>
              <input className="border rounded-lg px-3 py-2" placeholder="Khách hàng" value={projectForm.customer_name} onChange={e => setProjectForm({...projectForm, customer_name: e.target.value})}/>
              <select className="border rounded-lg px-3 py-2" value={projectForm.location_type} onChange={e => setProjectForm({...projectForm, location_type: e.target.value})}><option value="hanoi">Hà Nội - PC 100k</option><option value="province">Tỉnh - PC 50k</option></select>
              <select className="border rounded-lg px-3 py-2" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value})}><option value="active">Đang thi công</option><option value="done">Hoàn thành</option></select>
              <button onClick={addProject} className="bg-slate-900 text-white rounded-lg px-3 py-2">Thêm công trình</button>
            </div>}
            <div className="grid md:grid-cols-3 gap-3">{projects.map(p => <div key={p.id} className="border rounded-2xl p-4"><div className="font-semibold">{p.project_name}</div><div className="text-sm text-slate-500">{p.customer_name}</div><div className="mt-2 text-sm">{p.location_type === 'hanoi' ? 'Hà Nội - phụ cấp 100k/ngày' : 'Tỉnh - phụ cấp 50k/ngày'}</div></div>)}</div>
          </section>
        )}

        {tab === 'risk' && (
          <section className="bg-white rounded-2xl border p-4 grid md:grid-cols-2 gap-3">
            <Risk title="Dữ liệu lương" text="Nhân viên chỉ nên thấy dữ liệu cá nhân. Bản demo đang dùng chọn vai trò thủ công; bản chính thức cần đăng nhập OTP/mật khẩu." />
            <Risk title="Chốt công cuối tháng" text="Nên thêm trạng thái khóa công sau khi tính lương để tránh sửa số liệu." />
            <Risk title="Thuế TNCN 10%" text="Cần CCCD/MST cá nhân, bảng kê chi trả và chứng từ khấu trừ khi cần." />
            <Risk title="BHXH" text="Tách rõ nhân viên chính thức và nhân công khoán để giảm rủi ro bị truy đóng BHXH." />
          </section>
        )}
      </main>
    </div>
  )
}

function Kpi({ icon, label, value }) {
  return <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">{React.cloneElement(icon, { size: 28 })}<div><div className="text-sm text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></div></div>
}

function Table({ headers, children }) {
  return <div className="overflow-auto border rounded-xl"><table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>{headers.map(h => <th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function Risk({ title, text }) {
  return <div className="border rounded-xl p-4"><div className="font-semibold">{title}</div><p className="text-sm text-slate-600 mt-2">{text}</p></div>
}
