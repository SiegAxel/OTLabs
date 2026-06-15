import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'clients',
    loadComponent: () => import('./features/clients/clients.component').then(m => m.ClientsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'work-orders/new',
    loadComponent: () => import('./features/work-orders/ot-new/ot-new.component').then(m => m.OtNewComponent),
    canActivate: [authGuard],
  },
  {
    path: 'work-orders/:id/quotation',
    loadComponent: () => import('./features/work-orders/ot-quotation/ot-quotation.component').then(m => m.OtQuotationComponent),
    canActivate: [authGuard],
  },
  {
    path: 'work-orders/:id',
    loadComponent: () => import('./features/work-orders/ot-detail/ot-detail.component').then(m => m.OtDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'work-orders',
    loadComponent: () => import('./features/work-orders/ot-list/ot-list.component').then(m => m.OtListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'technicians',
    loadComponent: () => import('./features/technicians/technicians.component').then(m => m.TechniciansComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'company',
    loadComponent: () => import('./features/company/company.component').then(m => m.CompanyComponent),
    canActivate: [adminGuard],
  },
  { path: '**', redirectTo: 'dashboard' },
];
