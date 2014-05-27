/* Generated by Opal 0.6.2 */
/* port of QuadSphere by Cesar Rincon
 * c.f. https://github.com/cix/QuadSphere
 * Copyright (c) 2012 Cesar Rincon <crincon@gmail.com>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER 
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function ($opal) {
    var self = $opal.top,
        $scope = $opal,
        nil = $opal.nil,
        $breaker = $opal.breaker,
        $slice = $opal.slice,
        $module = $opal.module;

    $opal.add_stubs(['$forward', '$forward_distort', '$inverse_distort', '$inverse', '$**', '$-', '$+', '$*', '$new', '$-@', '$respond_to?', '$private_constant', '$cos', '$sin', '$each_with_index', '$nil?', '$>', '$call', '$[]', '$/', '$sqrt', '$atan2', '$asin']);
    return (function ($base) {
        var self = $module($base, 'QuadSphere');

        var def = self._proto,
            $scope = self._scope;

        $opal.cdecl($scope, 'TOP_FACE', 0);

        $opal.cdecl($scope, 'FRONT_FACE', 1);

        $opal.cdecl($scope, 'EAST_FACE', 2);

        $opal.cdecl($scope, 'BACK_FACE', 3);

        $opal.cdecl($scope, 'WEST_FACE', 4);

        $opal.cdecl($scope, 'BOTTOM_FACE', 5);

        (function ($base) {
            var self = $module($base, 'CSC');

            var def = self._proto,
                $scope = self._scope;

            $opal.defs(self, '$forward', function (phi, theta) {
                var $a, self = this,
                    face = nil,
                    chi = nil,
                    psi = nil;

                $a = $opal.to_ary($scope.Tangential.$forward(phi, theta)), face = ($a[0] == null ? nil : $a[0]), chi = ($a[1] == null ? nil : $a[1]), psi = ($a[2] == null ? nil : $a[2]);
                return [face, self.$forward_distort(chi, psi), self.$forward_distort(psi, chi)];
            });

            $opal.defs(self, '$inverse', function (face, x, y) {
                var self = this,
                    chi = nil,
                    psi = nil;

                chi = self.$inverse_distort(x, y);
                psi = self.$inverse_distort(y, x);
                return $scope.Tangential.$inverse(face, chi, psi);
            });

            $opal.defs(self, '$forward_distort', function (chi, psi) {
                var self = this,
                    chi2 = nil,
                    chi3 = nil,
                    psi2 = nil,
                    omchi2 = nil;

                chi2 = chi['$**'](2);
                chi3 = chi['$**'](3);
                psi2 = psi['$**'](2);
                omchi2 = (1.0)['$-'](chi2);
                return chi['$*'](((1.37484847732)['$-']((0.37484847732)['$*'](chi2))))['$+'](chi['$*'](psi2)['$*'](omchi2)['$*'](((-0.13161671474)['$+']((0.136486206721)['$*'](chi2))['$+'](((1.0)['$-'](psi2))['$*'](((0.141189631152)['$+'](psi2['$*'](((-0.281528535557)['$+']((0.106959469314)['$*'](psi2)))))['$+'](chi2['$*'](((0.0809701286525)['$+']((0.15384112876)['$*'](psi2))['$-']((0.178251207466)['$*'](chi2)))))))))))['$+'](chi3['$*'](omchi2)['$*'](((-0.159596235474)['$-']((omchi2['$*'](((0.0759196200467)['$-']((0.0217762490699)['$*'](chi2)))))))));
            });

            $opal.defs(self, '$inverse_distort', function (x, y) {
                var self = this,
                    x2 = nil,
                    x4 = nil,
                    x6 = nil,
                    x8 = nil,
                    x10 = nil,
                    x12 = nil,
                    y2 = nil,
                    y4 = nil,
                    y6 = nil,
                    y8 = nil,
                    y10 = nil,
                    y12 = nil;

                x2 = x['$*'](x);
                x4 = x['$**'](4);
                x6 = x['$**'](6);
                x8 = x['$**'](8);
                x10 = x['$**'](10);
                x12 = x['$**'](12);
                y2 = y['$*'](y);
                y4 = y['$**'](4);
                y6 = y['$**'](6);
                y8 = y['$**'](8);
                y10 = y['$**'](10);
                y12 = y['$**'](12);
                return x['$+'](x['$*'](((1)['$-'](x2)))['$*'](((-0.27292696)['$-']((0.07629969)['$*'](x2))['$-']((0.22797056)['$*'](x4))['$+']((0.54852384)['$*'](x6))['$-']((0.62930065)['$*'](x8))['$+']((0.25795794)['$*'](x10))['$+']((0.02584375)['$*'](x12))['$-']((0.02819452)['$*'](y2))['$-']((0.01471565)['$*'](x2)['$*'](y2))['$+']((0.48051509)['$*'](x4)['$*'](y2))['$-']((1.74114454)['$*'](x6)['$*'](y2))['$+']((1.71547508)['$*'](x8)['$*'](y2))['$-']((0.53022337)['$*'](x10)['$*'](y2))['$+']((0.2705816)['$*'](y4))['$-']((0.56800938)['$*'](x2)['$*'](y4))['$+']((0.30803317)['$*'](x4)['$*'](y4))['$+']((0.98938102)['$*'](x6)['$*'](y4))['$-']((0.83180469)['$*'](x8)['$*'](y4))['$-']((0.6044156)['$*'](y6))['$+']((1.50880086)['$*'](x2)['$*'](y6))['$-']((0.93678576)['$*'](x4)['$*'](y6))['$+']((0.08693841)['$*'](x6)['$*'](y6))['$+']((0.93412077)['$*'](y8))['$-']((1.4160192)['$*'](x2)['$*'](y8))['$+']((0.33887446)['$*'](x4)['$*'](y8))['$-']((0.63915306)['$*'](y10))['$+']((0.52032238)['$*'](x2)['$*'](y10))['$+']((0.14381585)['$*'](y12)))));
            });

        })(self);

        (function ($base) {
            var self = $module($base, 'Tangential');

            var def = self._proto,
                $scope = self._scope,
                $a, $b, TMP_1, $c, TMP_2, $d, TMP_3, $e, TMP_4, $f, TMP_5, $g, TMP_6, $h, TMP_8, $i, TMP_9, $j, TMP_10, $k, TMP_11, $l, TMP_12, $m, TMP_13;

            $opal.cdecl($scope, 'FORWARD_PARAMETERS', [($a = ($b = $scope.Proc).$new, $a._p = (TMP_1 = function (l, m, n) {
                var self = TMP_1._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [m, l['$-@'](), n];
            }, TMP_1._s = self, TMP_1), $a).call($b), ($a = ($c = $scope.Proc).$new, $a._p = (TMP_2 = function (l, m, n) {
                var self = TMP_2._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [m, n, l];
            }, TMP_2._s = self, TMP_2), $a).call($c), ($a = ($d = $scope.Proc).$new, $a._p = (TMP_3 = function (l, m, n) {
                var self = TMP_3._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [l['$-@'](), n, m];
            }, TMP_3._s = self, TMP_3), $a).call($d), ($a = ($e = $scope.Proc).$new, $a._p = (TMP_4 = function (l, m, n) {
                var self = TMP_4._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [m['$-@'](), n, l['$-@']()];
            }, TMP_4._s = self, TMP_4), $a).call($e), ($a = ($f = $scope.Proc).$new, $a._p = (TMP_5 = function (l, m, n) {
                var self = TMP_5._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [l, n, m['$-@']()];
            }, TMP_5._s = self, TMP_5), $a).call($f), ($a = ($g = $scope.Proc).$new, $a._p = (TMP_6 = function (l, m, n) {
                var self = TMP_6._s || this;
                if (l == null) l = nil;
                if (m == null) m = nil;
                if (n == null) n = nil;
                return [m, l, n['$-@']()];
            }, TMP_6._s = self, TMP_6), $a).call($g)]);

            if ((($a = self['$respond_to?']("private_constant")) !== nil && (!$a._isBoolean || $a == true))) {
                self.$private_constant("FORWARD_PARAMETERS");
            };

            $opal.defs(self, '$forward', function (phi, theta) {
                var $a, $b, TMP_7, self = this,
                    l = nil,
                    m = nil,
                    n = nil,
                    max = nil,
                    face = nil,
                    xi = nil,
                    eta = nil,
                    zeta = nil,
                    chi = nil,
                    psi = nil;

                l = Math.cos(theta)['$*'](Math.cos(phi));
                m = Math.cos(theta)['$*'](Math.sin(phi));
                n = Math.sin(theta);
                $a = [nil, -1], max = $a[0], face = $a[1];
                ($a = ($b = [n, l, m, l['$-@'](), m['$-@'](), n['$-@']()]).$each_with_index, $a._p = (TMP_7 = function (v, i) {
                    var self = TMP_7._s || this,
                        $a, $b;
                    if (v == null) v = nil;
                    if (i == null) i = nil;
                    if ((($a = ((($b = max['$nil?']()) !== false && $b !== nil) ? $b : v['$>'](max))) !== nil && (!$a._isBoolean || $a == true))) {
                        return $a = [v, i], max = $a[0], face = $a[1];
                    } else {
                        return nil;
                    }
                }, TMP_7._s = self, TMP_7), $a).call($b);
                $a = $opal.to_ary($scope.FORWARD_PARAMETERS['$[]'](face).$call(l, m, n)), xi = ($a[0] == null ? nil : $a[0]), eta = ($a[1] == null ? nil : $a[1]), zeta = ($a[2] == null ? nil : $a[2]);
                chi = xi['$/'](zeta);
                psi = eta['$/'](zeta);
                return [face, chi, psi];
            });

            $opal.cdecl($scope, 'INVERSE_PARAMETERS', [($a = ($h = $scope.Proc).$new, $a._p = (TMP_8 = function (xi, eta, zeta) {
                var self = TMP_8._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [eta['$-@'](), xi, zeta];
            }, TMP_8._s = self, TMP_8), $a).call($h), ($a = ($i = $scope.Proc).$new, $a._p = (TMP_9 = function (xi, eta, zeta) {
                var self = TMP_9._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [zeta, xi, eta];
            }, TMP_9._s = self, TMP_9), $a).call($i), ($a = ($j = $scope.Proc).$new, $a._p = (TMP_10 = function (xi, eta, zeta) {
                var self = TMP_10._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [xi['$-@'](), zeta, eta];
            }, TMP_10._s = self, TMP_10), $a).call($j), ($a = ($k = $scope.Proc).$new, $a._p = (TMP_11 = function (xi, eta, zeta) {
                var self = TMP_11._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [zeta['$-@'](), xi['$-@'](), eta];
            }, TMP_11._s = self, TMP_11), $a).call($k), ($a = ($l = $scope.Proc).$new, $a._p = (TMP_12 = function (xi, eta, zeta) {
                var self = TMP_12._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [xi, zeta['$-@'](), eta];
            }, TMP_12._s = self, TMP_12), $a).call($l), ($a = ($m = $scope.Proc).$new, $a._p = (TMP_13 = function (xi, eta, zeta) {
                var self = TMP_13._s || this;
                if (xi == null) xi = nil;
                if (eta == null) eta = nil;
                if (zeta == null) zeta = nil;
                return [eta, xi, zeta['$-@']()];
            }, TMP_13._s = self, TMP_13), $a).call($m)]);

            if ((($a = self['$respond_to?']("private_constant")) !== nil && (!$a._isBoolean || $a == true))) {
                self.$private_constant("INVERSE_PARAMETERS");
            };

            $opal.defs(self, '$inverse', function (face, chi, psi) {
                var $a, self = this,
                    zeta = nil,
                    xi = nil,
                    eta = nil,
                    l = nil,
                    m = nil,
                    n = nil;

                zeta = (1.0)['$/'](Math.sqrt((1.0)['$+'](chi['$**'](2))['$+'](psi['$**'](2))));
                xi = chi['$*'](zeta);
                eta = psi['$*'](zeta);
                $a = $opal.to_ary($scope.INVERSE_PARAMETERS['$[]'](face).$call(xi, eta, zeta)), l = ($a[0] == null ? nil : $a[0]), m = ($a[1] == null ? nil : $a[1]), n = ($a[2] == null ? nil : $a[2]);
                return [Math.atan2(m, l), Math.asin(n)];
            });

        })(self);
        
    })(self);
    
})(Opal);