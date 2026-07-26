import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QuillModule } from 'ngx-quill';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { Company } from '../../core/models';
import { CompanyService } from '../../core/services/company.service';
import {
  CommercialTextKind,
  CommercialTextOption,
  CommercialTextsService,
} from '../../core/services/commercial-texts.service';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule, MatSnackBarModule,
    PageShellComponent,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Mi Negocio</h2>
          <div class="subtitle">Datos que aparecerán en tus cotizaciones PDF</div>
        </div>
      </div>

      <div class="company-layout">
        <div class="company-main">
          <div class="card">
            <form [formGroup]="form" (ngSubmit)="save()" class="company-form">
              <h3 style="margin-bottom:16px">Datos generales</h3>
              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Nombre o razón social *</mat-label>
                  <input matInput formControlName="name">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>RUT</mat-label>
                  <input matInput formControlName="rut">
                </mat-form-field>
              </div>
              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Teléfono</mat-label>
                  <input matInput formControlName="phone">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput formControlName="email" type="email">
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Dirección</mat-label>
                <input matInput formControlName="address">
              </mat-form-field>
              <div style="display:flex;justify-content:flex-end;margin-top:8px">
                <button type="submit" class="btn btn-primary" [disabled]="saving()">
                  <span class="material-icons">save</span>
                  {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </div>
            </form>
          </div>

          <div class="catalog-summary-grid">
            <div class="card catalog-summary-card">
              <div class="catalog-summary-head">
                <div>
                  <h3>Condiciones comerciales</h3>
                  <p class="text-sm text-secondary">{{ activeCount('conditions') }} activas para seleccionar</p>
                </div>
                <button type="button" class="btn btn-outline btn-sm" (click)="openCatalogDialog('conditions')">
                  <span class="material-icons">settings</span> Gestionar
                </button>
              </div>
              <div class="selected-block" *ngIf="defaultCondition(); else noDefaultCondition">
                <span class="selected-label">Por defecto</span>
                <strong>{{ defaultCondition()!.title }}</strong>
                <div class="rich-preview" [innerHTML]="defaultCondition()!.content"></div>
              </div>
              <ng-template #noDefaultCondition>
                <div class="empty-catalog">Sin condicion por defecto</div>
              </ng-template>
            </div>

            <div class="card catalog-summary-card">
              <div class="catalog-summary-head">
                <div>
                  <h3>Garantias</h3>
                  <p class="text-sm text-secondary">{{ activeCount('warranties') }} activas para seleccionar</p>
                </div>
                <button type="button" class="btn btn-outline btn-sm" (click)="openCatalogDialog('warranties')">
                  <span class="material-icons">settings</span> Gestionar
                </button>
              </div>
              <div class="selected-block" *ngIf="defaultWarranty(); else noDefaultWarranty">
                <span class="selected-label">Por defecto</span>
                <strong>{{ defaultWarranty()!.title }}</strong>
                <div class="rich-preview" [innerHTML]="defaultWarranty()!.content"></div>
              </div>
              <ng-template #noDefaultWarranty>
                <div class="empty-catalog">Sin garantia por defecto</div>
              </ng-template>
            </div>
          </div>
        </div>

        <div class="card logo-panel">
          <h3 style="margin-bottom:16px">Logo del negocio</h3>
          <div class="logo-preview" *ngIf="company()?.logo_path">
            <img [src]="logoUrl()" alt="Logo" class="logo-img">
          </div>
          <div class="logo-placeholder" *ngIf="!company()?.logo_path">
            <span class="material-icons">business</span>
            <p class="text-muted text-sm">Sin logo cargado</p>
          </div>
          <label class="btn btn-outline w-full" style="cursor:pointer;margin-top:16px;text-align:center;display:flex;justify-content:center">
            <span class="material-icons">upload</span> Subir logo
            <input type="file" accept="image/*" style="display:none" (change)="uploadLogo($event)">
          </label>
          <p class="text-xs text-muted" style="margin-top:8px;text-align:center">PNG, JPG o SVG · Max 2MB</p>

          <hr class="divider">
          <div class="plan-badge">
            <span class="material-icons">verified</span>
            Plan {{ company()?.plan_type | uppercase }}
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .company-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .company-layout { grid-template-columns: 1fr; } }
    .company-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    .company-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .catalog-summary-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .catalog-summary-card { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
    .catalog-summary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .catalog-summary-head h3 { margin: 0 0 4px; }
    .selected-block { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; background: var(--color-surface-alt); }
    .selected-block strong { display: block; margin-bottom: 6px; color: var(--color-text-primary); }
    .rich-preview { color: var(--color-text-secondary); font-size: 14px; line-height: 1.45; }
    .rich-preview :first-child { margin-top: 0; }
    .rich-preview :last-child { margin-bottom: 0; }
    .selected-label { display: inline-flex; width: fit-content; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-700); font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .empty-catalog { border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: 18px; color: var(--color-text-secondary); font-size: 14px; text-align: center; }
    .logo-panel { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 20px; }
    .logo-preview { display: flex; justify-content: center; padding: 16px; background: var(--color-surface-alt); border-radius: 10px; }
    .logo-img { max-height: 100px; max-width: 100%; object-fit: contain; }
    .logo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; background: var(--color-surface-alt); border-radius: 10px; border: 2px dashed var(--color-border); .material-icons { font-size: 40px; color: var(--color-border-strong); } }
    .plan-badge { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--color-primary-600); .material-icons { font-size: 18px; color: var(--color-accent-500); } }
    @media (max-width: 1100px) { .catalog-summary-grid { grid-template-columns: 1fr; } }
    @media (max-width: 650px) { .form-row-2 { grid-template-columns: 1fr; } .catalog-summary-head { flex-direction: column; } }
  `],
})
export class CompanyComponent implements OnInit {
  company = signal<Company | null>(null);
  saving  = signal(false);
  conditions = signal<CommercialTextOption[]>([]);
  warranties = signal<CommercialTextOption[]>([]);

  form = this.fb.group({
    name:             [''],
    rut:              [''],
    phone:            [''],
    email:            [''],
    address:          [''],
    quote_conditions: [''],
    quote_warranty:   [''],
  });

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private commercialTexts: CommercialTextsService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.companyService.getCompany().subscribe(c => {
      this.company.set(c);
      this.form.patchValue(c as any);
      const catalog = this.commercialTexts.getCatalog(c);
      this.conditions.set(catalog.conditions);
      this.warranties.set(catalog.warranties);
      this.patchDefaultCommercialTexts();
    });
  }

  logoUrl(): string {
    const p = this.company()?.logo_path;
    if (!p) return '';
    return p;
  }

  save() {
    this.patchDefaultCommercialTexts();
    this.saving.set(true);
    this.companyService.updateCompany(this.form.value as any).subscribe({
      next: c => { this.company.set(c); this.saving.set(false); this.snack.open('Mi negocio actualizado', '', { duration: 2500 }); },
      error: () => { this.saving.set(false); this.snack.open('Error al guardar', '', { duration: 3000 }); },
    });
  }

  uploadLogo(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.companyService.uploadLogo(file).subscribe({
      next: c => { this.company.set(c); this.snack.open('Logo actualizado', '', { duration: 2500 }); },
      error: () => this.snack.open('Error al subir logo', '', { duration: 3000 }),
    });
  }

  openCatalogDialog(kind: CommercialTextKind) {
    const ref = this.dialog.open(CommercialTextCatalogDialogComponent, {
      width: '860px',
      maxWidth: 'calc(100vw - 32px)',
      data: {
        kind,
        options: this.listFor(kind)(),
      } satisfies CommercialTextDialogData,
    });

    ref.afterClosed().subscribe((options?: CommercialTextOption[]) => {
      if (!options) return;
      this.listFor(kind).set(options);
      this.saveCatalogs();
    });
  }

  defaultCondition(): CommercialTextOption | undefined {
    return this.conditions().find((option) => option.isDefault);
  }

  defaultWarranty(): CommercialTextOption | undefined {
    return this.warranties().find((option) => option.isDefault);
  }

  activeCount(kind: CommercialTextKind): number {
    return this.listFor(kind)().filter((option) => option.active).length;
  }

  private saveCatalogs() {
    this.commercialTexts.saveCatalog({
      conditions: this.conditions(),
      warranties: this.warranties(),
    });
    const catalog = this.commercialTexts.getCatalog(this.company());
    this.conditions.set(catalog.conditions);
    this.warranties.set(catalog.warranties);
    this.patchDefaultCommercialTexts();
    this.snack.open('Catalogo actualizado', '', { duration: 2500 });
  }

  private listFor(kind: CommercialTextKind) {
    return kind === 'conditions' ? this.conditions : this.warranties;
  }

  private patchDefaultCommercialTexts() {
    this.form.patchValue({
      quote_conditions: this.conditions().find((option) => option.isDefault)?.content ?? '',
      quote_warranty: this.warranties().find((option) => option.isDefault)?.content ?? '',
    });
  }
}

interface CommercialTextDialogData {
  kind: CommercialTextKind;
  options: CommercialTextOption[];
}

@Component({
  selector: 'app-commercial-text-catalog-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    QuillModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>

    <mat-dialog-content>
      <div class="catalog-dialog">
        <aside class="option-list">
          <div class="option-list-head">
            <span>{{ options.length }} registros</span>
            <button type="button" class="btn btn-primary btn-sm" (click)="newOption()">
              <span class="material-icons">add</span> Nuevo
            </button>
          </div>

          <button
            type="button"
            class="option-row"
            *ngFor="let option of options"
            [class.selected]="option.id === selectedId"
            (click)="selectOption(option.id)">
            <span class="option-title">{{ option.title }}</span>
            <span class="option-meta">
              <span *ngIf="option.isDefault">Por defecto</span>
              <span *ngIf="option.active">Activa</span>
              <span *ngIf="!option.active">Inactiva</span>
            </span>
          </button>

          <div class="empty-options" *ngIf="options.length === 0">
            Sin registros creados
          </div>
        </aside>

        <section class="option-editor" *ngIf="selectedId; else noSelection">
          <form [formGroup]="form" class="editor-form">
            <mat-form-field appearance="outline">
              <mat-label>Titulo</mat-label>
              <input matInput formControlName="title">
            </mat-form-field>

            <div class="rich-editor-field">
              <label>{{ contentLabel() }}</label>
              <quill-editor
                formControlName="content"
                theme="snow"
                format="html"
                [modules]="editorModules"
                placeholder="Escribe el texto que aparecera en la cotizacion">
              </quill-editor>
            </div>

            <div class="editor-options">
              <label>
                <input type="checkbox" formControlName="active" [disabled]="!!form.value.isDefault">
                Activa para seleccionar en cotizaciones
              </label>
              <label>
                <input type="checkbox" formControlName="isDefault" (change)="onDefaultChange()">
                Usar como texto por defecto
              </label>
            </div>

            <div class="editor-actions">
              <button type="button" class="btn btn-outline btn-sm danger-text" (click)="deleteSelected()">
                <span class="material-icons">delete</span> Eliminar
              </button>
              <button type="button" class="btn btn-outline btn-sm" (click)="applyCurrent()">
                <span class="material-icons">check</span> Aplicar cambios
              </button>
            </div>
          </form>
        </section>

        <ng-template #noSelection>
          <section class="option-editor empty-editor">
            <span class="material-icons">rule</span>
            <p>Selecciona un registro o crea uno nuevo.</p>
          </section>
        </ng-template>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button type="button" class="btn btn-outline" mat-dialog-close>Cancelar</button>
      <button type="button" class="btn btn-primary" (click)="saveAndClose()">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }
    .catalog-dialog { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; min-height: 420px; }
    .option-list { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .option-list-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--color-text-secondary); font-size: 13px; margin-bottom: 4px; }
    .option-row { width: 100%; text-align: left; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); padding: 10px; cursor: pointer; display: flex; flex-direction: column; gap: 5px; }
    .option-row.selected { border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }
    .option-title { font-weight: 700; color: var(--color-text-primary); overflow-wrap: anywhere; }
    .option-meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; color: var(--color-text-secondary); }
    .option-meta span { border-radius: 999px; background: var(--color-surface-alt); padding: 2px 7px; }
    .option-editor { min-width: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; }
    .editor-form { display: flex; flex-direction: column; gap: 8px; }
    .rich-editor-field { display: flex; flex-direction: column; gap: 8px; }
    .rich-editor-field > label { color: var(--color-text-secondary); font-size: 13px; font-weight: 700; }
    .rich-editor-field quill-editor { display: block; background: var(--color-surface); }
    .rich-editor-field .ql-toolbar { border-color: var(--color-border); border-radius: var(--radius-md) var(--radius-md) 0 0; }
    .rich-editor-field .ql-container { min-height: 180px; border-color: var(--color-border); border-radius: 0 0 var(--radius-md) var(--radius-md); font: inherit; }
    .editor-options { display: flex; flex-direction: column; gap: 8px; color: var(--color-text-secondary); font-size: 14px; }
    .editor-options label { display: flex; align-items: center; gap: 8px; }
    .editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 8px; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 24px 20px; }
    .danger-text { color: var(--color-error); }
    .empty-options, .empty-editor { color: var(--color-text-secondary); text-align: center; }
    .empty-options { border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: 18px; }
    .empty-editor { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 100%; }
    .empty-editor .material-icons { font-size: 36px; color: var(--color-border-strong); }
    @media (max-width: 760px) { .catalog-dialog { grid-template-columns: 1fr; min-height: 0; } }
  `],
})
export class CommercialTextCatalogDialogComponent {
  options: CommercialTextOption[];
  selectedId = '';
  editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  form = this.fb.group({
    title: [''],
    content: [''],
    active: [true],
    isDefault: [false],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CommercialTextDialogData,
    private dialogRef: MatDialogRef<CommercialTextCatalogDialogComponent>,
    private fb: FormBuilder,
  ) {
    this.options = data.options.map((option) => ({ ...option }));
    this.selectedId = this.options[0]?.id ?? '';
    this.loadSelected();
  }

  title(): string {
    return this.data.kind === 'conditions' ? 'Gestionar condiciones comerciales' : 'Gestionar garantias';
  }

  contentLabel(): string {
    return this.data.kind === 'conditions' ? 'Texto de la condicion comercial' : 'Texto de la garantia';
  }

  newOption() {
    this.applyCurrent();
    const option: CommercialTextOption = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      title: this.data.kind === 'conditions' ? 'Nueva condicion' : 'Nueva garantia',
      content: '',
      active: true,
      isDefault: this.options.length === 0,
    };
    this.options = [...this.options, option];
    this.selectedId = option.id;
    this.loadSelected();
  }

  selectOption(id: string) {
    this.applyCurrent();
    this.selectedId = id;
    this.loadSelected();
  }

  onDefaultChange() {
    if (this.form.value.isDefault) {
      this.form.patchValue({ active: true });
    }
  }

  applyCurrent() {
    if (!this.selectedId) return;
    const title = this.form.value.title?.trim() || 'Sin titulo';
    const content = this.form.value.content?.trim() || '';
    const isDefault = !!this.form.value.isDefault;

    this.options = this.options.map((option) => {
      if (option.id !== this.selectedId) {
        return isDefault ? { ...option, isDefault: false } : option;
      }
      return {
        ...option,
        title,
        content,
        active: isDefault ? true : !!this.form.value.active,
        isDefault,
      };
    });
  }

  deleteSelected() {
    if (!this.selectedId) return;
    const removed = this.options.find((option) => option.id === this.selectedId);
    this.options = this.options.filter((option) => option.id !== this.selectedId);
    if (removed?.isDefault && this.options.length > 0) {
      this.options[0] = { ...this.options[0], active: true, isDefault: true };
    }
    this.selectedId = this.options[0]?.id ?? '';
    this.loadSelected();
  }

  saveAndClose() {
    this.applyCurrent();
    const cleaned = this.options.filter((option) => option.content.trim());
    if (cleaned.length > 0 && !cleaned.some((option) => option.isDefault)) {
      cleaned[0] = { ...cleaned[0], active: true, isDefault: true };
    }
    this.dialogRef.close(cleaned);
  }

  private loadSelected() {
    const option = this.options.find((item) => item.id === this.selectedId);
    if (!option) {
      this.form.reset({ title: '', content: '', active: true, isDefault: false });
      return;
    }

    this.form.reset({
      title: option.title,
      content: option.content,
      active: option.active,
      isDefault: option.isDefault,
    });
  }
}
