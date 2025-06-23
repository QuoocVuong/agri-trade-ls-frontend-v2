// src/app/core/services/location.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import {shareReplay, catchError, switchMap} from 'rxjs/operators';


export interface Province {
  idProvince: string;
  name: string;
}
export interface District {
  idProvince: string;
  idDistrict: string;
  name: string;
}

interface WardFromJson {
  idDistrict: string;
  idCommune: string;
  name: string;
}

export interface Ward {
  idDistrict: string;
  idWard: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private http = inject(HttpClient);
  private provinces$: Observable<Province[]> | null = null;
  private districts$: Observable<District[]> | null = null;
  private mappedWards$: Observable<Ward[]> | null = null;
  private dataPath = 'assets/data/';

  getProvinces(): Observable<Province[]> {
    if (!this.provinces$) {
      this.provinces$ = this.http.get<Province[]>(`${this.dataPath}provinces.json`).pipe(
        shareReplay(1),
        catchError(err => {
          console.error("Error loading provinces.json", err);
          this.provinces$ = null;
          return of([]);
        })
      );
    }
    return this.provinces$;
  }

  getDistricts(provinceCode: string | null): Observable<District[]> {
    if (!provinceCode) return of([]);
    if (!this.districts$) {
      this.districts$ = this.http.get<District[]>(`${this.dataPath}districts.json`).pipe(
        shareReplay(1),
        catchError(err => {
          console.error("Error loading districts.json", err);
          this.districts$ = null;
          return of([]);
        })
      );
    }
    // *** Lọc theo idProvince ***
    return this.districts$.pipe(
      map(districts => districts.filter(d => d.idProvince === provinceCode))
    );
  }

  getWards(districtCode: string | null): Observable<Ward[]> {
    if (!districtCode) return of([]);
    if (!this.mappedWards$) {
      this.mappedWards$ = this.http.get<WardFromJson[]>(`${this.dataPath}wards.json`).pipe(
        map(wardsFromJson => {
          // *** Đổi tên trường idCommune thành wardCode ***
          return wardsFromJson.map(w => ({
            idDistrict: w.idDistrict,
            idWard: w.idCommune,
            name: w.name
          }));
        }),
        shareReplay(1),
        catchError(err => {
          console.error("Error loading wards.json", err);
          this.mappedWards$ = null;
          return of([]);
        })
      );
    }
    // *** Lọc theo idDistrict ***
    return this.mappedWards$.pipe(
      map(wards => wards.filter(w => w.idDistrict === districtCode))
    );
  }

  // --- Các hàm tìm tên  ---
  // Cần load data trước khi dùng hiệu quả
  findProvinceName(code: string | null): Observable<string | null> {
    if (!code) return of(null);
    return this.getProvinces().pipe(
      map(provinces => provinces.find(p => p.idProvince === code)?.name ?? null)
    );
  }
  findDistrictName(code: string | null): Observable<string | null> {
    if (!code) return of(null);
    // Cần load districts$ trước
    if (!this.districts$) return this.getDistricts('any').pipe( // Tải lần đầu nếu chưa có
      switchMap(() => this.findDistrictName(code)) // Gọi lại sau khi tải
    );
    return this.districts$.pipe(
      map(districts => districts.find(d => d.idDistrict === code)?.name ?? null)
    );
  }
  findWardName(code: string | null): Observable<string | null> {
    if (!code) return of(null);
    if (!this.mappedWards$) return this.getWards('any').pipe( // Tải lần đầu nếu chưa có
      switchMap(() => this.findWardName(code))
    );
    return this.mappedWards$.pipe(
      map(wards => wards.find(w => w.idWard === code)?.name ?? null)
    );
  }

}
