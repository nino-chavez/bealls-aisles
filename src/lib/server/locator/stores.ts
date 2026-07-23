/**
 * Sample store data for the Bealls family of brands.
 *
 * Layer: foundation (locator surface) — drives `/store-locator` route + the
 * proximity-aware bopis-strip block (PRD-ENG-017). Real Bealls store data
 * lives in their internal locator system; this file is a representative
 * sample for this prototype and is not real merchant operational data.
 *
 * Per-brand:
 *   - bealls / beallsflorida share the same store network (Bealls Outlet +
 *     Bealls Florida footprint across the Southeast).
 *   - homecentric (content mode) has its own smaller HC-branded footprint.
 *
 * Coordinates are real city centers (approximate to the storefront block).
 * Hours follow a single template — Phase 6 stub. Real hours per-day would
 * come from the merchant ops system in production.
 */

export type Store = {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	zip: string;
	lat: number;
	lng: number;
	phone: string;
	hours: string;
	pickupReady: boolean;
};

const BEALLS_STORES: Store[] = [
	{
		id: 'bealls-sarasota',
		name: 'Bealls Sarasota',
		address: '4040 S Tamiami Trl',
		city: 'Sarasota',
		state: 'FL',
		zip: '34231',
		lat: 27.2806,
		lng: -82.5307,
		phone: '(941) 921-7300',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-st-pete',
		name: 'Bealls St. Petersburg',
		address: '6901 22nd Ave N',
		city: 'St. Petersburg',
		state: 'FL',
		zip: '33710',
		lat: 27.7906,
		lng: -82.7321,
		phone: '(727) 343-2522',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-tampa',
		name: 'Bealls Tampa',
		address: '8019 Citrus Park Town Center Mall',
		city: 'Tampa',
		state: 'FL',
		zip: '33625',
		lat: 28.0644,
		lng: -82.5709,
		phone: '(813) 920-5455',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-orlando',
		name: 'Bealls Orlando',
		address: '7575 W Sand Lake Rd',
		city: 'Orlando',
		state: 'FL',
		zip: '32819',
		lat: 28.4486,
		lng: -81.4695,
		phone: '(407) 363-1077',
		hours: 'Open 10am–9pm',
		pickupReady: false,
	},
	{
		id: 'bealls-jacksonville',
		name: 'Bealls Jacksonville',
		address: '11700 Beach Blvd',
		city: 'Jacksonville',
		state: 'FL',
		zip: '32246',
		lat: 30.2867,
		lng: -81.5167,
		phone: '(904) 642-1500',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-miami',
		name: 'Bealls Miami',
		address: '1455 NW 107th Ave',
		city: 'Miami',
		state: 'FL',
		zip: '33172',
		lat: 25.7762,
		lng: -80.3766,
		phone: '(305) 470-9988',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-savannah',
		name: 'Bealls Savannah',
		address: '14045 Abercorn St',
		city: 'Savannah',
		state: 'GA',
		zip: '31419',
		lat: 31.9923,
		lng: -81.1762,
		phone: '(912) 925-7700',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-mobile',
		name: 'Bealls Mobile',
		address: '3266 Bel Air Mall',
		city: 'Mobile',
		state: 'AL',
		zip: '36606',
		lat: 30.6741,
		lng: -88.1077,
		phone: '(251) 471-6230',
		hours: 'Open 10am–9pm',
		pickupReady: false,
	},
	{
		id: 'bealls-charlotte',
		name: 'Bealls Charlotte',
		address: '9101 Pineville-Matthews Rd',
		city: 'Charlotte',
		state: 'NC',
		zip: '28226',
		lat: 35.0863,
		lng: -80.8517,
		phone: '(704) 752-9292',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
	{
		id: 'bealls-phoenix',
		name: 'Bealls Phoenix',
		address: '4525 E Cactus Rd',
		city: 'Phoenix',
		state: 'AZ',
		zip: '85032',
		lat: 33.5973,
		lng: -111.9837,
		phone: '(602) 953-0606',
		hours: 'Open 10am–9pm',
		pickupReady: true,
	},
];

const HOMECENTRIC_STORES: Store[] = [
	{
		id: 'hc-sarasota',
		name: 'Home Centric Sarasota',
		address: '4040 S Tamiami Trl',
		city: 'Sarasota',
		state: 'FL',
		zip: '34231',
		lat: 27.2806,
		lng: -82.5307,
		phone: '(941) 921-7300',
		hours: 'Open 10am–8pm',
		pickupReady: false,
	},
	{
		id: 'hc-tampa',
		name: 'Home Centric Tampa',
		address: '8019 Citrus Park Town Center Mall',
		city: 'Tampa',
		state: 'FL',
		zip: '33625',
		lat: 28.0644,
		lng: -82.5709,
		phone: '(813) 920-5455',
		hours: 'Open 10am–8pm',
		pickupReady: false,
	},
	{
		id: 'hc-orlando',
		name: 'Home Centric Orlando',
		address: '7575 W Sand Lake Rd',
		city: 'Orlando',
		state: 'FL',
		zip: '32819',
		lat: 28.4486,
		lng: -81.4695,
		phone: '(407) 363-1077',
		hours: 'Open 10am–8pm',
		pickupReady: false,
	},
	{
		id: 'hc-jacksonville',
		name: 'Home Centric Jacksonville',
		address: '11700 Beach Blvd',
		city: 'Jacksonville',
		state: 'FL',
		zip: '32246',
		lat: 30.2867,
		lng: -81.5167,
		phone: '(904) 642-1500',
		hours: 'Open 10am–8pm',
		pickupReady: false,
	},
];

const STORES_BY_BRAND: Record<string, Store[]> = {
	bealls: BEALLS_STORES,
	beallsflorida: BEALLS_STORES,
	homecentric: HOMECENTRIC_STORES,
};

export function getStoresForBrand(brandId: string): Store[] {
	return STORES_BY_BRAND[brandId] ?? BEALLS_STORES;
}
