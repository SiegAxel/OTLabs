import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { QuillModule } from 'ngx-quill';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { ClpCurrencyPipe } from '../../../shared/pipes/clp-currency.pipe';
import { WorkOrder } from '../../../core/models';
import { WorkOrdersService } from '../../../core/services/work-orders.service';
import { CompanyService } from '../../../core/services/company.service';
import { CommercialTextOption, CommercialTextsService } from '../../../core/services/commercial-texts.service';

@Component({
  selector: 'app-ot-quotation',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule, MatSnackBarModule, MatIconModule, QuillModule,
    PageShellComponent, ClpCurrencyPipe,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <a [routerLink]="['/work-orders', otId()]" class="back-link">
            <span class="material-icons">arrow_back</span> Volver a OT
          </a>
          <h2 class="mt-4">Cotización — OT-{{ otId() | number:'4.0-0' }}</h2>
          <p class="subtitle" *ngIf="ot()">{{ ot()!.title }}</p>
        </div>
        <button class="btn btn-primary" type="button" *ngIf="hasQuotation()" (click)="downloadPdf()">
            <span class="material-icons">picture_as_pdf</span> Ver PDF
        </button>
      </div>

      <div class="quotation-layout">
        <!-- Editor -->
        <div class="card">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <h3 style="margin-bottom:16px">Ítems de trabajo</h3>

            <div class="items-header">
              <span>Descripción</span><span>Cant.</span><span>P. Unitario</span><span>Total</span><span></span>
            </div>

            <div formArrayName="items">
              <div *ngFor="let item of items.controls; let i = index" [formGroupName]="i" class="item-row">
                <mat-form-field appearance="outline">
                  <input matInput formControlName="description" placeholder="Descripción del servicio o material">
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-sm">
                  <input matInput type="number" formControlName="qty" min="0.1" step="0.5">
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-md">
                  <input matInput type="number" formControlName="unit_price" min="0" step="100">
                  <span matPrefix>$</span>
                </mat-form-field>
                <div class="item-total">{{ itemTotal(i) | clp }}</div>
                <button type="button" mat-icon-button (click)="removeItem(i)" color="warn">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" (click)="addItem()">
              <span class="material-icons">add</span> Agregar ítem
            </button>

            <hr class="divider">

            <section class="quotation-section">
              <div class="section-mini-header">
                <span class="material-icons">receipt_long</span>
                <h4>Facturación</h4>
              </div>
              <div class="form-row-2">
              <mat-form-field appearance="outline">
                <mat-label>Descuento (CLP)</mat-label>
                <input matInput type="number" formControlName="discount" min="0">
                <span matPrefix>$</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Vigencia (días)</mat-label>
                <input matInput type="number" formControlName="validity_days" min="1">
                </mat-form-field>
              </div>
            </section>

            <section class="quotation-section">
              <div class="section-mini-header">
                <span class="material-icons">description</span>
                <h4>Condiciones comerciales</h4>
              </div>
            <div class="commercial-picker">
              <div>
                <span class="picker-label">Texto seleccionado</span>
                <strong>{{ selectedCommercialTextTitle('conditions') }}</strong>
                <span class="text-origin" [attr.data-origin]="commercialTextOrigin('conditions')">
                  {{ commercialTextOriginLabel('conditions') }}
                </span>
                <small>{{ conditionOptions().length }} opciones activas disponibles</small>
              </div>
              <button type="button" class="btn btn-outline btn-sm" (click)="openCommercialTextDialog('conditions')">
                <span class="material-icons">more_horiz</span> Ver opciones
              </button>
              </div>

            <div class="rich-editor-field">
              <label>Detalle de condiciones</label>
              <quill-editor
                formControlName="conditions"
                theme="snow"
                format="html"
                [modules]="editorModules"
                placeholder="Condiciones comerciales de esta cotizacion">
              </quill-editor>
            </div>
            </section>

            <section class="quotation-section">
              <div class="section-mini-header">
                <span class="material-icons">verified</span>
                <h4>Garantía</h4>
              </div>
            <div class="commercial-picker">
              <div>
                <span class="picker-label">Texto seleccionado</span>
                <strong>{{ selectedCommercialTextTitle('warranties') }}</strong>
                <span class="text-origin" [attr.data-origin]="commercialTextOrigin('warranties')">
                  {{ commercialTextOriginLabel('warranties') }}
                </span>
                <small>{{ warrantyOptions().length }} opciones activas disponibles</small>
              </div>
              <button type="button" class="btn btn-outline btn-sm" (click)="openCommercialTextDialog('warranties')">
                <span class="material-icons">more_horiz</span> Ver opciones
              </button>
            </div>

            <div class="rich-editor-field">
              <label>Detalle de garantía</label>
              <quill-editor
                formControlName="warranty"
                theme="snow"
                format="html"
                [modules]="editorModules"
                placeholder="Garantia de esta cotizacion">
              </quill-editor>
            </div>
            </section>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="loading()">
                <span class="material-icons">save</span>
                {{ loading() ? 'Guardando...' : (hasQuotation() ? 'Actualizar' : 'Crear cotización') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Summary -->
        <div class="summary-panel">
          <div class="card">
            <h3 style="margin-bottom:16px">Resumen</h3>
            <div class="summary-rows">
              <div class="s-row"><span>Subtotal</span><span>{{ subtotal() | clp }}</span></div>
              <div class="s-row" *ngIf="form.value.discount"><span>Descuento</span><span class="text-success">- {{ form.value.discount | clp }}</span></div>
              <div class="s-row total"><span>TOTAL</span><span>{{ total() | clp }}</span></div>
            </div>
            <button class="btn btn-outline w-full mt-4" type="button" style="margin-top:16px" *ngIf="hasQuotation()" (click)="downloadPdf()">
                <span class="material-icons">picture_as_pdf</span> Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-secondary); text-decoration: none; font-size: 14px; .material-icons { font-size: 18px; } &:hover { color: var(--color-primary-600); } }
    .quotation-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .quotation-layout { grid-template-columns: 1fr; } }
    .quotation-layout > .card { min-width: 0; }
    .items-header { display: grid; grid-template-columns: 1fr 80px 120px 90px 40px; gap: 8px; padding: 0 0 8px; font-size: 12px; font-weight: 600; color: var(--color-primary-600); text-transform: uppercase; }
    .item-row { display: grid; grid-template-columns: 1fr 80px 120px 90px 40px; gap: 8px; align-items: center; margin-bottom: 4px; }
    .item-row mat-form-field { min-width: 0; }
    .field-sm { width: 80px; } .field-md { width: 120px; }
    .item-total { font-size: 14px; font-weight: 600; color: var(--color-text-primary); text-align: right; white-space: nowrap; }
    .quotation-section { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; background: var(--color-surface); }
    .section-mini-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--color-primary-700); }
    .section-mini-header .material-icons { font-size: 20px; }
    .section-mini-header h4 { margin: 0; font-size: 15px; color: var(--color-text-primary); }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .commercial-picker { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 12px; background: var(--color-surface-alt); }
    .commercial-picker > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .commercial-picker strong { color: var(--color-text-primary); overflow-wrap: anywhere; }
    .commercial-picker small, .picker-label { color: var(--color-text-secondary); font-size: 12px; }
    .picker-label { font-weight: 700; text-transform: uppercase; }
    .text-origin { align-self: flex-start; border-radius: var(--radius-full); padding: 3px 9px; font-size: 11px; font-weight: 700; background: var(--color-primary-100); color: var(--color-primary-700); }
    .text-origin[data-origin="custom"] { background: var(--color-warning-bg); color: #92400e; }
    .text-origin[data-origin="saved"] { background: var(--color-info-bg); color: var(--color-info); }
    .rich-editor-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .rich-editor-field > label { color: var(--color-text-secondary); font-size: 13px; font-weight: 700; }
    .rich-editor-field quill-editor { display: block; background: var(--color-surface); }
    .rich-editor-field .ql-toolbar { border-color: var(--color-border); border-radius: var(--radius-md) var(--radius-md) 0 0; }
    .rich-editor-field .ql-container { min-height: 140px; border-color: var(--color-border); border-radius: 0 0 var(--radius-md) var(--radius-md); font: inherit; }
    .form-actions { display: flex; justify-content: flex-end; padding-top: 8px; }
    .summary-panel { position: sticky; top: 20px; }
    .summary-rows { display: flex; flex-direction: column; gap: 8px; }
    .s-row { display: flex; justify-content: space-between; font-size: 14px; }
    .s-row.total { font-weight: 700; font-size: 18px; color: var(--color-primary-600); border-top: 2px solid var(--color-primary-200); padding-top: 10px; margin-top: 4px; }
    @media (max-width: 600px) {
      .items-header { display: none; }
      .item-row {
        grid-template-columns: 1fr 44px;
        gap: 8px 10px;
        padding: 12px 0;
        border-bottom: 1px solid var(--color-border);
      }
      .item-row mat-form-field:first-child {
        grid-column: 1 / -1;
      }
      .field-sm,
      .field-md {
        width: 100%;
      }
      .item-total {
        grid-column: 1;
        text-align: left;
      }
      .item-row button {
        grid-column: 2;
        grid-row: 2 / span 2;
        align-self: center;
      }
      .form-row-2 {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .form-actions .btn {
        width: 100%;
      }
      .commercial-picker {
        flex-direction: column;
        align-items: stretch;
      }
      .summary-panel {
        position: static;
      }
    }
  `],
})
export class OtQuotationComponent implements OnInit {
  editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  form = this.fb.group({
    items:        this.fb.array([]),
    discount:     [0],
    conditions:   [''],
    warranty:     [''],
    validity_days:[15],
  });

  ot = signal<WorkOrder | null>(null);
  hasQuotation = signal(false);
  loading = signal(false);
  otId = signal(0);
  conditionOptions = signal<CommercialTextOption[]>([]);
  warrantyOptions = signal<CommercialTextOption[]>([]);
  selectedConditionId = signal('custom');
  selectedWarrantyId = signal('custom');

  constructor(
    private fb: FormBuilder,
    private workOrdersService: WorkOrdersService,
    private companyService: CompanyService,
    private commercialTexts: CommercialTextsService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  get items() { return this.form.get('items') as FormArray; }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.otId.set(id);
    this.loadCommercialOptions();
    this.workOrdersService.getWorkOrder(id).subscribe(ot => {
      this.ot.set(ot);
      if (!this.canEditQuotation(ot)) {
        this.snack.open('La cotización no se puede modificar en este estado', '', { duration: 3000 });
        this.router.navigate(['/work-orders', id]);
        return;
      }

      if (ot.quotation) {
        this.hasQuotation.set(true);
        ot.quotation.items.forEach(item => this.items.push(this.makeItem(item)));
        this.form.patchValue({
          discount: ot.quotation.discount,
          conditions: ot.quotation.conditions ?? '',
          warranty: ot.quotation.warranty ?? '',
          validity_days: ot.quotation.validity_days,
        });
        this.matchSelectedCommercialTexts();
      } else {
        this.addItem();
        this.applyDefaultsToNewQuotation();
      }
    });
  }

  makeItem(item?: any) {
    return this.fb.group({
      description: [item?.description ?? '', Validators.required],
      qty:         [item?.qty ?? 1],
      unit_price:  [item?.unit_price ?? 0],
    });
  }

  addItem()    { this.items.push(this.makeItem()); }
  removeItem(i: number) { this.items.removeAt(i); }

  itemTotal(i: number): number {
    const g = this.items.at(i).value;
    return (g.qty ?? 0) * (g.unit_price ?? 0);
  }

  subtotal(): number {
    return this.items.controls.reduce((s, c) => s + (c.value.qty ?? 0) * (c.value.unit_price ?? 0), 0);
  }

  total(): number {
    return Math.max(this.subtotal() - (this.form.value.discount ?? 0), 0);
  }

  onSubmit() {
    if (!this.canEditQuotation(this.ot())) {
      this.snack.open('La cotización no se puede modificar en este estado', '', { duration: 3000 });
      return;
    }

    const payload = { ...this.form.value };
    this.loading.set(true);
    const req = this.hasQuotation()
      ? this.workOrdersService.updateQuotation(this.otId(), payload as any)
      : this.workOrdersService.createQuotation(this.otId(), payload as any);

    req.subscribe({
      next: () => {
        this.hasQuotation.set(true);
        this.loading.set(false);
        this.snack.open('Cotización guardada', '', { duration: 2500 });
      },
      error: () => { this.loading.set(false); this.snack.open('Error al guardar', '', { duration: 3000 }); },
    });
  }

  downloadPdf() {
    const id = this.otId();
    this.workOrdersService.getPdf(id).subscribe({
      next: (blob) => this.openBlob(blob, `OT-${String(id).padStart(4, '0')}.txt`),
      error: () => this.snack.open('Error al descargar cotización', '', { duration: 3000 }),
    });
  }

  applyCommercialText(kind: 'conditions' | 'warranties', optionId: string) {
    const options = kind === 'conditions' ? this.conditionOptions() : this.warrantyOptions();
    const selected = options.find((option) => option.id === optionId);

    if (kind === 'conditions') {
      this.selectedConditionId.set(optionId);
      if (selected) this.form.patchValue({ conditions: selected.content });
      return;
    }

    this.selectedWarrantyId.set(optionId);
    if (selected) this.form.patchValue({ warranty: selected.content });
  }

  openCommercialTextDialog(kind: 'conditions' | 'warranties') {
    const currentContent = kind === 'conditions' ? this.form.value.conditions ?? '' : this.form.value.warranty ?? '';
    const options = kind === 'conditions' ? this.conditionOptions() : this.warrantyOptions();
    const ref = this.dialog.open(QuotationCommercialTextDialogComponent, {
      width: '780px',
      maxWidth: 'calc(100vw - 32px)',
      data: {
        kind,
        currentContent,
        options,
      } satisfies QuotationCommercialTextDialogData,
    });

    ref.afterClosed().subscribe((selected?: CommercialTextOption | 'custom') => {
      if (!selected || selected === 'custom') return;
      this.applyCommercialText(kind, selected.id);
    });
  }

  selectedCommercialTextTitle(kind: 'conditions' | 'warranties'): string {
    const currentContent = kind === 'conditions' ? this.form.value.conditions : this.form.value.warranty;
    const options = kind === 'conditions' ? this.conditionOptions() : this.warrantyOptions();
    const selected = options.find((option) => this.sameHtml(option.content, currentContent ?? ''));
    return selected?.title ?? 'Especifica para esta OT';
  }

  commercialTextOrigin(kind: 'conditions' | 'warranties'): 'default' | 'saved' | 'custom' {
    const currentContent = kind === 'conditions' ? this.form.value.conditions : this.form.value.warranty;
    const options = kind === 'conditions' ? this.conditionOptions() : this.warrantyOptions();
    const selected = options.find((option) => this.sameHtml(option.content, currentContent ?? ''));
    if (!selected) return 'custom';
    return selected.isDefault ? 'default' : 'saved';
  }

  commercialTextOriginLabel(kind: 'conditions' | 'warranties'): string {
    const origin = this.commercialTextOrigin(kind);
    if (origin === 'default') return 'Predeterminada';
    if (origin === 'saved') return 'Opción guardada';
    return 'Personalizada para esta cotización';
  }

  private loadCommercialOptions() {
    this.companyService.getCompany().subscribe({
      next: (company) => {
        this.conditionOptions.set(this.commercialTexts.activeOptions('conditions', company));
        this.warrantyOptions.set(this.commercialTexts.activeOptions('warranties', company));
        this.applyDefaultsToNewQuotation();
        this.matchSelectedCommercialTexts();
      },
    });
  }

  private applyDefaultsToNewQuotation() {
    if (this.hasQuotation()) return;

    const defaultCondition = this.conditionOptions().find((option) => option.isDefault) ?? this.conditionOptions()[0];
    const defaultWarranty = this.warrantyOptions().find((option) => option.isDefault) ?? this.warrantyOptions()[0];

    if (defaultCondition && !this.form.value.conditions) {
      this.selectedConditionId.set(defaultCondition.id);
      this.form.patchValue({ conditions: defaultCondition.content });
    }

    if (defaultWarranty && !this.form.value.warranty) {
      this.selectedWarrantyId.set(defaultWarranty.id);
      this.form.patchValue({ warranty: defaultWarranty.content });
    }
  }

  private matchSelectedCommercialTexts() {
    const condition = this.conditionOptions().find((option) => this.sameHtml(option.content, this.form.value.conditions ?? ''));
    const warranty = this.warrantyOptions().find((option) => this.sameHtml(option.content, this.form.value.warranty ?? ''));
    this.selectedConditionId.set(condition?.id ?? 'custom');
    this.selectedWarrantyId.set(warranty?.id ?? 'custom');
  }

  private sameHtml(a: string, b: string): boolean {
    return this.normalizeHtml(a) === this.normalizeHtml(b);
  }

  private normalizeHtml(value: string): string {
    return (value ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  }

  private openBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private canEditQuotation(ot: WorkOrder | null): boolean {
    const status = ot?.status;
    return status === 'diagnosis' || status === 'quotation_sent';
  }
}

interface QuotationCommercialTextDialogData {
  kind: 'conditions' | 'warranties';
  currentContent: string;
  options: CommercialTextOption[];
}

@Component({
  selector: 'app-quotation-commercial-text-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>

    <mat-dialog-content>
      <div class="current-selection">
        <span>Seleccion actual</span>
        <strong>{{ currentTitle() }}</strong>
      </div>

      <div class="option-list" *ngIf="data.options.length > 0; else noOptions">
        <button
          type="button"
          class="option-card"
          *ngFor="let option of data.options"
          [class.selected]="isSelected(option)"
          (click)="select(option)">
          <div class="option-head">
            <div>
              <strong>{{ option.title }}</strong>
              <span *ngIf="option.isDefault">Por defecto</span>
            </div>
            <mat-icon>{{ isSelected(option) ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
          </div>
          <div class="option-preview" [innerHTML]="option.content"></div>
        </button>
      </div>

      <ng-template #noOptions>
        <div class="empty-options">No hay opciones activas configuradas.</div>
      </ng-template>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button type="button" class="btn btn-outline" (click)="keepCustom()">Mantener especifica</button>
      <button type="button" class="btn btn-outline" mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .current-selection { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; background: var(--color-surface-alt); margin-bottom: 14px; display: flex; flex-direction: column; gap: 3px; }
    .current-selection span { color: var(--color-text-secondary); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .current-selection strong { color: var(--color-text-primary); }
    .option-list { display: flex; flex-direction: column; gap: 10px; max-height: 52vh; overflow: auto; padding-right: 4px; }
    .option-card { width: 100%; text-align: left; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; background: var(--color-surface); cursor: pointer; display: flex; flex-direction: column; gap: 8px; }
    .option-card.selected { border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }
    .option-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .option-head > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
    .option-head strong { color: var(--color-text-primary); overflow-wrap: anywhere; }
    .option-head span { border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-700); font-size: 11px; font-weight: 700; padding: 2px 8px; }
    .option-head mat-icon { color: var(--color-primary-600); }
    .option-preview { color: var(--color-text-secondary); font-size: 14px; line-height: 1.45; }
    .option-preview :first-child { margin-top: 0; }
    .option-preview :last-child { margin-bottom: 0; }
    .empty-options { border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: 24px; color: var(--color-text-secondary); text-align: center; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 24px 20px; }
  `],
})
export class QuotationCommercialTextDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: QuotationCommercialTextDialogData,
    private dialogRef: MatDialogRef<QuotationCommercialTextDialogComponent>,
  ) {}

  title(): string {
    return this.data.kind === 'conditions' ? 'Seleccionar condiciones comerciales' : 'Seleccionar garantia';
  }

  currentTitle(): string {
    const selected = this.data.options.find((option) => this.isSelected(option));
    return selected?.title ?? 'Especifica para esta OT';
  }

  isSelected(option: CommercialTextOption): boolean {
    return this.normalizeHtml(option.content) === this.normalizeHtml(this.data.currentContent);
  }

  select(option: CommercialTextOption) {
    this.dialogRef.close(option);
  }

  keepCustom() {
    this.dialogRef.close('custom');
  }

  private normalizeHtml(value: string): string {
    return (value ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  }
}
