import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { ClpCurrencyPipe } from '../../../shared/pipes/clp-currency.pipe';
import { ApiService } from '../../../core/services/api.service';
import { WorkOrder } from '../../../core/models';

@Component({
  selector: 'app-ot-quotation',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatIconModule,
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
        <a [href]="pdfUrl()" target="_blank" *ngIf="hasQuotation()">
          <button class="btn btn-primary">
            <span class="material-icons">picture_as_pdf</span> Ver PDF
          </button>
        </a>
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

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Condiciones comerciales</mat-label>
              <textarea matInput formControlName="conditions" rows="2"></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Garantía</mat-label>
              <textarea matInput formControlName="warranty" rows="2"></textarea>
            </mat-form-field>

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
            <a [href]="pdfUrl()" target="_blank" *ngIf="hasQuotation()">
              <button class="btn btn-outline w-full mt-4" style="margin-top:16px">
                <span class="material-icons">picture_as_pdf</span> Descargar PDF
              </button>
            </a>
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-secondary); text-decoration: none; font-size: 14px; .material-icons { font-size: 18px; } &:hover { color: var(--color-primary-600); } }
    .quotation-layout { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .quotation-layout { grid-template-columns: 1fr; } }
    .items-header { display: grid; grid-template-columns: 1fr 80px 120px 90px 40px; gap: 8px; padding: 0 0 8px; font-size: 12px; font-weight: 600; color: var(--color-primary-600); text-transform: uppercase; }
    .item-row { display: grid; grid-template-columns: 1fr 80px 120px 90px 40px; gap: 8px; align-items: center; margin-bottom: 4px; }
    .field-sm { width: 80px; } .field-md { width: 120px; }
    .item-total { font-size: 14px; font-weight: 600; color: var(--color-text-primary); text-align: right; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; padding-top: 8px; }
    .summary-panel { position: sticky; top: 20px; }
    .summary-rows { display: flex; flex-direction: column; gap: 8px; }
    .s-row { display: flex; justify-content: space-between; font-size: 14px; }
    .s-row.total { font-weight: 700; font-size: 18px; color: var(--color-primary-600); border-top: 2px solid var(--color-primary-200); padding-top: 10px; margin-top: 4px; }
    @media (max-width: 600px) {
      .items-header { display: none; }
      .item-row { grid-template-columns: 1fr; }
    }
  `],
})
export class OtQuotationComponent implements OnInit {
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

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  get items() { return this.form.get('items') as FormArray; }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.otId.set(id);
    this.api.getWorkOrder(id).subscribe(ot => {
      this.ot.set(ot);
      if (ot.quotation) {
        this.hasQuotation.set(true);
        ot.quotation.items.forEach(item => this.items.push(this.makeItem(item)));
        this.form.patchValue({
          discount: ot.quotation.discount,
          conditions: ot.quotation.conditions ?? '',
          warranty: ot.quotation.warranty ?? '',
          validity_days: ot.quotation.validity_days,
        });
      } else {
        this.addItem();
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

  pdfUrl(): string { return this.api.getPdfUrl(this.otId()); }

  onSubmit() {
    const payload = { ...this.form.value };
    this.loading.set(true);
    const req = this.hasQuotation()
      ? this.api.updateQuotation(this.otId(), payload as any)
      : this.api.createQuotation(this.otId(), payload as any);

    req.subscribe({
      next: () => {
        this.hasQuotation.set(true);
        this.loading.set(false);
        this.snack.open('Cotización guardada', '', { duration: 2500 });
      },
      error: () => { this.loading.set(false); this.snack.open('Error al guardar', '', { duration: 3000 }); },
    });
  }
}
