import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-page-shell',
  standalone: true,
  imports: [
    CommonModule, RouterModule, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule,
  ],
  template: `
    <div class="shell" [class.sidebar-collapsed]="collapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo-mark" *ngIf="!collapsed()">
            <span class="logo-icon material-icons">ac_unit</span>
            <span class="logo-text">OTClima</span>
          </div>
          <button class="collapse-btn" type="button" (click)="toggleCollapse()" [matTooltip]="collapsed() ? 'Expandir' : 'Colapsar'">
            <span class="material-icons">{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</span>
          </button>
        </div>

        <nav class="sidebar-nav">
          <a *ngFor="let item of visibleNavItems()"
             [routerLink]="item.route"
             routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? item.label : ''"
             matTooltipPosition="right">
            <span class="material-icons">{{ item.icon }}</span>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
          </a>
        </nav>

        <div class="sidebar-footer" *ngIf="!collapsed()">
          <div class="user-info">
            <div class="user-avatar">{{ initials() }}</div>
            <div class="user-details">
              <div class="user-name">{{ auth.currentUser()?.name }}</div>
              <div class="user-role">{{ roleLabel() }}</div>
            </div>
          </div>
          <button class="logout-btn" (click)="auth.logout()" matTooltip="Cerrar sesión">
            <span class="material-icons">logout</span>
          </button>
        </div>
        <div class="sidebar-footer-collapsed" *ngIf="collapsed()">
          <button class="collapse-btn" (click)="auth.logout()" matTooltip="Cerrar sesión" matTooltipPosition="right">
            <span class="material-icons">logout</span>
          </button>
        </div>
      </aside>

      <!-- Mobile Header -->
      <header class="mobile-header">
        <div class="mobile-logo">
          <span class="material-icons" style="color:var(--color-primary-500)">ac_unit</span>
          <span>OTClima</span>
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-sm text-secondary">{{ auth.currentUser()?.name }}</span>
          <button class="mobile-user-btn" type="button" [matMenuTriggerFor]="userMenu" aria-label="Menú de usuario">
            <div class="user-avatar-sm">{{ initials() }}</div>
          </button>
        </div>
        <mat-menu #userMenu>
          <a *ngIf="auth.isAdmin()" mat-menu-item routerLink="/company"><mat-icon>business</mat-icon>Mi empresa</a>
          <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon>Salir</button>
        </mat-menu>
      </header>

      <!-- Main content -->
      <main class="main-content">
        <ng-content></ng-content>
      </main>

      <!-- Mobile Bottom Nav -->
      <nav class="bottom-nav">
        <a *ngFor="let item of visibleMobileNavItems()"
           [routerLink]="item.route"
           routerLinkActive="active"
           class="bottom-nav-item">
          <span class="material-icons">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      min-height: 100vh;
      background: var(--color-bg);
    }

    // ─── Sidebar ─────────────────────────────────────────────────────────────
    .sidebar {
      width: var(--sidebar-width);
      min-height: 100vh;
      background: var(--color-primary-900);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width .2s;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: hidden;
      z-index: 20;
    }

    .shell.sidebar-collapsed .sidebar { width: 64px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      height: var(--header-height);
      min-height: var(--header-height);
    }

    .logo-mark {
      display: flex; align-items: center; gap: 10px;
      min-width: 0;
      overflow: hidden; white-space: nowrap;
    }

    .logo-icon {
      color: var(--color-primary-300);
      font-size: 28px;
      flex-shrink: 0;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      color: white;
      letter-spacing: -.01em;
    }

    .collapse-btn {
      width: 32px; height: 32px;
      background: rgba(255,255,255,.08);
      border: none; border-radius: 6px;
      color: rgba(255,255,255,.6);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      .material-icons { font-size: 16px; }
      &:hover { background: rgba(255,255,255,.15); }
    }

    .shell.sidebar-collapsed .sidebar-header {
      justify-content: center;
      padding: 16px 0;
    }

    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
      display: flex; flex-direction: column; gap: 2px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      min-height: 44px;
      border-radius: 10px;
      color: rgba(255,255,255,.65);
      text-decoration: none;
      font-size: 14px; font-weight: 500;
      transition: all .12s;
      white-space: nowrap;
      overflow: hidden;

      .material-icons { font-size: 20px; flex-shrink: 0; }
      &:hover { background: rgba(255,255,255,.08); color: white; }
      &.active { background: var(--color-primary-600); color: white; }
    }

    .shell.sidebar-collapsed .sidebar-nav {
      align-items: center;
    }

    .shell.sidebar-collapsed .nav-item {
      justify-content: center;
      width: 48px;
      height: 44px;
      padding: 0;
      gap: 0;
    }

    .nav-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 64px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }

    .user-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--color-primary-600);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }

    .user-details { flex: 1; min-width: 0; overflow: hidden; }
    .user-name  { font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role  { font-size: 11px; color: rgba(255,255,255,.5); }

    .logout-btn {
      width: 32px; height: 32px;
      background: transparent; border: none;
      color: rgba(255,255,255,.5); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
      .material-icons { font-size: 18px; }
      &:hover { background: rgba(255,255,255,.08); color: white; }
    }

    .sidebar-footer-collapsed {
      padding: 12px 8px;
      border-top: 1px solid rgba(255,255,255,.08);
      display: flex; justify-content: center;
    }

    // ─── Mobile Header ────────────────────────────────────────────────────────
    .mobile-header {
      display: none;
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: var(--header-height);
      background: var(--color-primary-900);
      align-items: center; justify-content: space-between;
      padding: 0 16px;
      box-shadow: var(--shadow-md);
      gap: 12px;
    }

    .mobile-logo {
      display: flex; align-items: center; gap: 8px;
      font-size: 18px; font-weight: 700; color: white;
      min-width: 0;
      white-space: nowrap;
    }

    .mobile-header .text-sm {
      max-width: 42vw;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(255,255,255,.86) !important;
      line-height: 32px;
    }

    .mobile-user-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .user-avatar-sm {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--color-primary-600);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
    }

    // ─── Main ─────────────────────────────────────────────────────────────────
    .main-content {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
      min-width: 0;
    }

    // ─── Bottom Nav ───────────────────────────────────────────────────────────
    .bottom-nav {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
      height: 60px;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      box-shadow: 0 -2px 12px rgb(0 0 0 / 0.08);
    }

    .bottom-nav-item {
      flex: 1;
      min-width: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: 10px; font-weight: 500;
      transition: color .12s;

      .material-icons { font-size: 22px; }
      span:last-child {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &.active { color: var(--color-primary-600); }
      &:hover { color: var(--color-primary-500); }
    }

    // ─── Responsive ───────────────────────────────────────────────────────────
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .mobile-header { display: flex; }
      .bottom-nav { display: flex; }
      .main-content { padding: 16px; padding-top: calc(var(--header-height) + 16px); padding-bottom: 76px; }
    }
  `],
})
export class PageShellComponent {
  collapsed = signal(false);

  constructor(public auth: AuthService) {}

  navItems: NavItem[] = [
    { icon: 'dashboard',        label: 'Dashboard',   route: '/dashboard' },
    { icon: 'assignment',       label: 'Órd. de Trabajo', route: '/work-orders' },
    { icon: 'people',           label: 'Clientes',    route: '/clients' },
    { icon: 'engineering',      label: 'Técnicos',    route: '/technicians', adminOnly: true },
    { icon: 'bar_chart',        label: 'Reportes',    route: '/reports', adminOnly: true },
    { icon: 'business',         label: 'Mi Empresa',  route: '/company', adminOnly: true },
  ];

  mobileNavItems: NavItem[] = [
    { icon: 'dashboard',    label: 'Dashboard',  route: '/dashboard' },
    { icon: 'assignment',   label: 'OTs',        route: '/work-orders' },
    { icon: 'people',       label: 'Clientes',   route: '/clients' },
    { icon: 'bar_chart',    label: 'Reportes',   route: '/reports', adminOnly: true },
  ];

  visibleNavItems() {
    const isAdmin = this.auth.isAdmin();
    return this.navItems.filter(i => !i.adminOnly || isAdmin);
  }

  visibleMobileNavItems() {
    const isAdmin = this.auth.isAdmin();
    return this.mobileNavItems.filter(i => !i.adminOnly || isAdmin);
  }

  roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'superadmin') return 'SuperAdmin';
    if (role === 'admin') return 'Administrador';
    return 'Técnico';
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  toggleCollapse() { this.collapsed.update(v => !v); }
}
